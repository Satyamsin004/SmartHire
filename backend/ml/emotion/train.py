import os
import sys
import time
import json
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.emotion.model import SmartHireBehaviorCNN, count_parameters, get_model_config
from ml.emotion.dataset import get_data_loaders
from ml.emotion.validate_dataset import find_dataset_root

def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def train_one_epoch(
    model: nn.Module,
    dataloader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device
) -> Dict[str, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in dataloader:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / total if total > 0 else 0.0
    epoch_acc = (correct / total) * 100.0 if total > 0 else 0.0
    return {"loss": round(epoch_loss, 4), "accuracy": round(epoch_acc, 2)}

def evaluate_epoch(
    model: nn.Module,
    dataloader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    device: torch.device
) -> Dict[str, float]:
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in dataloader:
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    epoch_loss = running_loss / total if total > 0 else 0.0
    epoch_acc = (correct / total) * 100.0 if total > 0 else 0.0
    return {"loss": round(epoch_loss, 4), "accuracy": round(epoch_acc, 2)}

def run_training(
    epochs: int = 15,
    batch_size: int = 64,
    learning_rate: float = 0.001,
    seed: int = 42
) -> Dict[str, Any]:
    set_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dataset_root = find_dataset_root()

    print("\n" + "="*60)
    print("STARTING SMARTHIRE BEHAVIORAL MODEL TRAINING (ARCHIVE DATASET)")
    print("="*60)
    print(f"Device:           {device}")
    print(f"Dataset Root:     {dataset_root}")
    print(f"Target Epochs:    {epochs}")
    print(f"Batch Size:       {batch_size}")
    print(f"Initial LR:       {learning_rate}")
    print(f"Random Seed:      {seed}")

    data_info = get_data_loaders(
        dataset_root=dataset_root,
        batch_size=batch_size,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        seed=seed,
        num_workers=0
    )

    classes = data_info["classes"]
    num_classes = data_info["num_classes"]

    print(f"Discovered Classes ({num_classes}): {classes}")
    print(f"Total Unique Samples: {data_info['total_unique_count']}")
    print(f"Train Samples:        {data_info['train_count']}")
    print(f"Val Samples:          {data_info['val_count']}")
    print(f"Test Samples:         {data_info['test_count']}")
    print(f"Class Weights:        {[round(w, 2) for w in data_info['class_weights'].tolist()]}")

    model = SmartHireBehaviorCNN(num_classes=num_classes).to(device)
    param_count = count_parameters(model)
    print(f"Model Parameters:     {param_count:,}")

    criterion = nn.CrossEntropyLoss(weight=data_info["class_weights"].to(device))
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2)

    output_dir = os.path.join(os.path.dirname(__file__), "models", "checkpoints")
    reports_dir = os.path.join(os.path.dirname(__file__), "reports")
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    best_checkpoint_path = os.path.join(output_dir, "best_behavior_model.pt")
    secondary_checkpoint_path = os.path.join(output_dir, "smarthire_behavior_v2.pth")
    best_val_acc = 0.0
    best_epoch = 0

    history: List[Dict[str, Any]] = []
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_res = train_one_epoch(model, data_info["train_loader"], criterion, optimizer, device)
        val_res = evaluate_epoch(model, data_info["val_loader"], criterion, device)
        elapsed = time.time() - t0

        current_lr = optimizer.param_groups[0]['lr']
        scheduler.step(val_res["accuracy"])

        is_best = val_res["accuracy"] > best_val_acc
        if is_best:
            best_val_acc = val_res["accuracy"]
            best_epoch = epoch

            checkpoint_payload = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_accuracy": val_res["accuracy"],
                "val_loss": val_res["loss"],
                "train_accuracy": train_res["accuracy"],
                "train_loss": train_res["loss"],
                "config": get_model_config(classes),
                "class_mapping": {i: classes[i] for i in range(num_classes)},
                "classes": classes,
                "model_version": "smart-hire-behavior-v2.0",
                "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "device": str(device),
                "param_count": param_count
            }
            torch.save(checkpoint_payload, best_checkpoint_path)
            torch.save(checkpoint_payload, secondary_checkpoint_path)

        epoch_record = {
            "epoch": epoch,
            "train_loss": train_res["loss"],
            "train_acc": train_res["accuracy"],
            "val_loss": val_res["loss"],
            "val_acc": val_res["accuracy"],
            "lr": current_lr,
            "duration_seconds": round(elapsed, 1),
            "is_best": is_best
        }
        history.append(epoch_record)

        marker = " [* BEST CHECKPOINT SAVED]" if is_best else ""
        print(f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {train_res['loss']:.4f} Acc: {train_res['accuracy']:.2f}% | Val Loss: {val_res['loss']:.4f} Acc: {val_res['accuracy']:.2f}% | LR: {current_lr:.6f} | {elapsed:.1f}s{marker}")

    total_training_time = time.time() - start_time
    print("\n" + "="*60)
    print("TRAINING FINISHED")
    print("="*60)
    print(f"Total Training Duration: {total_training_time:.1f} seconds ({total_training_time/60.0:.2f} mins)")
    print(f"Best Validation Epoch:   {best_epoch}")
    print(f"Best Validation Acc:     {best_val_acc:.2f}%")
    print(f"Saved Checkpoint:        {best_checkpoint_path}")
    print(f"Saved Secondary Checkpt: {secondary_checkpoint_path}")

    # Save training history JSON
    history_file = os.path.join(reports_dir, "training_history.json")
    with open(history_file, "w") as f:
        json.dump({
            "model_version": "smart-hire-behavior-v2.0",
            "model_name": "SmartHireBehaviorCNN",
            "epochs_trained": epochs,
            "best_epoch": best_epoch,
            "best_val_accuracy": best_val_acc,
            "total_duration_seconds": round(total_training_time, 1),
            "classes": classes,
            "device": str(device),
            "param_count": param_count,
            "history": history
        }, f, indent=2)

    return {
        "best_checkpoint": best_checkpoint_path,
        "best_epoch": best_epoch,
        "best_val_acc": best_val_acc,
        "total_duration": total_training_time
    }

if __name__ == "__main__":
    run_training(epochs=15, batch_size=64, learning_rate=0.001)
