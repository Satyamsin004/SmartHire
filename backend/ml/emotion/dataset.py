import os
import random
import hashlib
import numpy as np
from PIL import Image, ImageEnhance
import torch
from torch.utils.data import Dataset, DataLoader
from typing import List, Tuple, Dict, Any, Optional

from ml.emotion.validate_dataset import find_dataset_root, discover_classes

def get_class_mappings(dataset_root: Optional[str] = None) -> Tuple[List[str], Dict[str, int], Dict[int, str]]:
    if not dataset_root:
        dataset_root = find_dataset_root()
    classes = discover_classes(dataset_root)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    idx_to_class = {i: c for i, c in enumerate(classes)}
    return classes, class_to_idx, idx_to_class

class SmartHireBehaviorDataset(Dataset):
    """
    High-performance PyTorch dataset for SmartHire Behavioral Expression Recognition.
    Processes images of varying resolutions into normalized 48x48 tensors.
    Applies on-the-fly augmentation to training split and deterministic normalization to validation/test.
    """
    def __init__(self, samples: List[Tuple[str, int]], is_train: bool = False, image_size: Tuple[int, int] = (48, 48)):
        self.samples = samples
        self.is_train = is_train
        self.image_size = image_size

    def __len__(self) -> int:
        return len(self.samples)

    def _augment_image(self, pil_img: Image.Image) -> Image.Image:
        # 1. Random horizontal flip (p=0.5)
        if random.random() > 0.5:
            pil_img = pil_img.transpose(Image.FLIP_LEFT_RIGHT)

        # 2. Random slight rotation (-10 to +10 degrees)
        if random.random() > 0.5:
            angle = random.uniform(-10.0, 10.0)
            pil_img = pil_img.rotate(angle, resample=Image.BILINEAR)

        # 3. Random slight brightness/contrast adjustment (0.85 to 1.15)
        if random.random() > 0.5:
            factor = random.uniform(0.85, 1.15)
            enhancer = ImageEnhance.Contrast(pil_img)
            pil_img = enhancer.enhance(factor)

        return pil_img

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        with Image.open(img_path) as img:
            gray_img = img.convert('L')
            if gray_img.size != self.image_size:
                gray_img = gray_img.resize(self.image_size, resample=Image.BILINEAR)

            if self.is_train:
                gray_img = self._augment_image(gray_img)

            # Convert to numpy array & normalize to [-1.0, 1.0]
            arr = np.array(gray_img, dtype=np.float32) / 255.0
            arr = (arr - 0.5) / 0.5
            tensor = torch.from_numpy(arr).unsqueeze(0)  # Shape: (1, H, W)

        return tensor, label

def load_unique_dataset_samples(dataset_root: str) -> Tuple[List[Tuple[str, int]], List[str]]:
    """
    Scans the dataset to gather unique image samples across discovered classes.
    Uses MD5 content hashing to deduplicate mirrored test/train copies and prevent data leakage.
    """
    classes, class_to_idx, _ = get_class_mappings(dataset_root)
    unique_samples: List[Tuple[str, int]] = []
    seen_hashes = set()

    train_dir = os.path.join(dataset_root, "train")
    for class_name in classes:
        c_dir = os.path.join(train_dir, class_name)
        if not os.path.isdir(c_dir):
            continue
        label = class_to_idx[class_name]
        for f in sorted(os.listdir(c_dir)):
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp')):
                full_path = os.path.join(c_dir, f)
                try:
                    with open(full_path, 'rb') as fp:
                        h = hashlib.md5(fp.read()).hexdigest()
                    if h not in seen_hashes:
                        seen_hashes.add(h)
                        unique_samples.append((full_path, label))
                except Exception:
                    continue

    return unique_samples, classes

def get_data_loaders(
    dataset_root: Optional[str] = None,
    batch_size: int = 64,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
    num_workers: int = 0
) -> Dict[str, Any]:
    """
    Creates reproducible, stratified Train, Validation, and Test data loaders from unique archive images.
    """
    if not dataset_root:
        dataset_root = find_dataset_root()

    random.seed(seed)
    np.random.seed(seed)

    all_samples, classes = load_unique_dataset_samples(dataset_root)
    num_classes = len(classes)

    # Stratified split per class
    class_buckets: Dict[int, List[Tuple[str, int]]] = {i: [] for i in range(num_classes)}
    for s in all_samples:
        class_buckets[s[1]].append(s)

    train_samples: List[Tuple[str, int]] = []
    val_samples: List[Tuple[str, int]] = []
    test_samples: List[Tuple[str, int]] = []

    for label, items in class_buckets.items():
        random.shuffle(items)
        n_total = len(items)
        n_val = int(n_total * val_ratio)
        n_test = int(n_total * test_ratio)
        n_train = n_total - n_val - n_test

        train_samples.extend(items[:n_train])
        val_samples.extend(items[n_train:n_train + n_val])
        test_samples.extend(items[n_train + n_val:])

    random.shuffle(train_samples)
    random.shuffle(val_samples)
    random.shuffle(test_samples)

    # Compute inverse-frequency class weights for CrossEntropyLoss
    class_counts_train = [len([s for s in train_samples if s[1] == i]) for i in range(num_classes)]
    total_train = max(1, len(train_samples))
    class_weights = [total_train / (float(num_classes) * max(cnt, 1)) for cnt in class_counts_train]
    class_weights_tensor = torch.tensor(class_weights, dtype=torch.float32)

    train_dataset = SmartHireBehaviorDataset(train_samples, is_train=True)
    val_dataset = SmartHireBehaviorDataset(val_samples, is_train=False)
    test_dataset = SmartHireBehaviorDataset(test_samples, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers, pin_memory=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=True)

    return {
        "train_loader": train_loader,
        "val_loader": val_loader,
        "test_loader": test_loader,
        "train_count": len(train_samples),
        "val_count": len(val_samples),
        "test_count": len(test_samples),
        "total_unique_count": len(all_samples),
        "class_counts_train": class_counts_train,
        "class_weights": class_weights_tensor,
        "classes": classes,
        "num_classes": num_classes
    }
