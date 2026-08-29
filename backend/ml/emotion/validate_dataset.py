import os
import json
from PIL import Image
from typing import Dict, Any, List

def find_dataset_root() -> str:
    """Discovers the archive root containing behavioral facial dataset."""
    candidate_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "archive")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "archive")),
        os.path.abspath("archive"),
        "/app/archive",
        "archive"
    ]
    for p in candidate_paths:
        if os.path.exists(p) and os.path.isdir(p):
            train_p = os.path.join(p, "train")
            test_p = os.path.join(p, "test")
            if os.path.exists(train_p) and os.path.exists(test_p):
                return p
    raise FileNotFoundError(f"Could not locate valid facial/behavioral dataset in: {candidate_paths}")

def discover_classes(dataset_root: str) -> List[str]:
    """Discovers actual class folder names from archive/train."""
    train_dir = os.path.join(dataset_root, "train")
    classes = [d for d in sorted(os.listdir(train_dir)) if os.path.isdir(os.path.join(train_dir, d))]
    return classes

def validate_and_inspect_dataset() -> Dict[str, Any]:
    dataset_root = find_dataset_root()
    classes = discover_classes(dataset_root)
    print(f"[*] Discovered Dataset at: {dataset_root}")
    print(f"[*] Discovered {len(classes)} Classes: {classes}")

    stats: Dict[str, Any] = {
        "dataset_path": dataset_root,
        "format": "Directory-based ImageFolder (train/test/{class_name}/*.jpg)",
        "classes": classes,
        "total_images": 0,
        "train_images": 0,
        "test_images": 0,
        "class_distribution": {c: 0 for c in classes},
        "split_distribution": {"train": {c: 0 for c in classes}, "test": {c: 0 for c in classes}},
        "image_shapes": {},
        "channel_counts": {},
        "corrupted_images": 0,
        "unreadable_images": 0,
        "invalid_labels": 0
    }

    for split in ["train", "test"]:
        split_dir = os.path.join(dataset_root, split)
        if not os.path.exists(split_dir):
            continue
        for class_name in os.listdir(split_dir):
            class_dir = os.path.join(split_dir, class_name)
            if not os.path.isdir(class_dir):
                continue

            if class_name not in classes:
                stats["invalid_labels"] += 1
                continue

            for img_name in os.listdir(class_dir):
                img_path = os.path.join(class_dir, img_name)
                if not os.path.isfile(img_path) or not img_name.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.webp')):
                    continue

                try:
                    with Image.open(img_path) as img:
                        w, h = img.size
                        mode = img.mode
                        shape_key = f"{w}x{h}"
                        stats["image_shapes"][shape_key] = stats["image_shapes"].get(shape_key, 0) + 1
                        stats["channel_counts"][mode] = stats["channel_counts"].get(mode, 0) + 1

                        stats["total_images"] += 1
                        if split == "train":
                            stats["train_images"] += 1
                        else:
                            stats["test_images"] += 1

                        stats["class_distribution"][class_name] += 1
                        stats["split_distribution"][split][class_name] += 1
                except Exception as e:
                    print(f"[!] Corrupt/unreadable image: {img_path} ({e})")
                    stats["corrupted_images"] += 1
                    stats["unreadable_images"] += 1

    reports_dir = os.path.join(os.path.dirname(__file__), "reports")
    os.makedirs(reports_dir, exist_ok=True)
    out_file = os.path.join(reports_dir, "dataset_statistics.json")
    with open(out_file, "w") as f:
        json.dump(stats, f, indent=2)

    print("\n" + "="*60)
    print("DATASET VALIDATION SUMMARY")
    print("="*60)
    print(f"Dataset Path:       {stats['dataset_path']}")
    print(f"Discovered Classes: {stats['classes']}")
    print(f"Total Image Files:  {stats['total_images']}")
    print(f"Train Partition:    {stats['train_images']}")
    print(f"Test Partition:     {stats['test_images']}")
    print(f"Corrupted Images:   {stats['corrupted_images']}")
    print("\nClass Distribution Across Dataset:")
    for c, cnt in stats["class_distribution"].items():
        print(f"  {c:<15}: {cnt} total (Train: {stats['split_distribution']['train'].get(c, 0)}, Test: {stats['split_distribution']['test'].get(c, 0)})")
    print(f"\nImage Resolutions (top 5): {dict(list(stats['image_shapes'].items())[:5])}")
    print(f"Channel Modes:             {stats['channel_counts']}")
    print(f"Report saved to:           {out_file}")
    print("="*60)

    return stats

if __name__ == "__main__":
    validate_and_inspect_dataset()
