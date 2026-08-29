import os
import sys
import time
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import torch
import torch.nn as nn
from typing import Dict, Any, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.emotion.model import SmartHireBehaviorCNN, BEHAVIOR_CLASSES
from ml.emotion.dataset import get_data_loaders
from ml.emotion.validate_dataset import find_dataset_root

def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    classes: List[str]
) -> Dict[str, Any]:
    num_classes = len(classes)
    confusion = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        confusion[t, p] += 1

    per_class = {}
    precisions = []
    recalls = []
    f1s = []
    supports = []

    for i in range(num_classes):
        c_name = classes[i]
        tp = confusion[i, i]
        fp = confusion[:, i].sum() - tp
        fn = confusion[i, :].sum() - tp
        support = confusion[i, :].sum()

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0

        per_class[c_name] = {
            "precision": round(prec * 100.0, 2),
            "recall": round(rec * 100.0, 2),
            "f1_score": round(f1 * 100.0, 2),
            "support": int(support)
        }
        precisions.append(prec)
        recalls.append(rec)
        f1s.append(f1)
        supports.append(support)

    total_samples = len(y_true)
    accuracy = float((y_true == y_pred).mean() * 100.0)
    macro_precision = float(np.mean(precisions) * 100.0)
    macro_recall = float(np.mean(recalls) * 100.0)
    macro_f1 = float(np.mean(f1s) * 100.0)

    weights = np.array(supports) / max(total_samples, 1)
    weighted_precision = float(np.sum(np.array(precisions) * weights) * 100.0)
    weighted_recall = float(np.sum(np.array(recalls) * weights) * 100.0)
    weighted_f1 = float(np.sum(np.array(f1s) * weights) * 100.0)

    return {
        "total_test_samples": total_samples,
        "test_accuracy": round(accuracy, 2),
        "macro_precision": round(macro_precision, 2),
        "weighted_precision": round(weighted_precision, 2),
        "macro_recall": round(macro_recall, 2),
        "weighted_recall": round(weighted_recall, 2),
        "macro_f1": round(macro_f1, 2),
        "weighted_f1": round(weighted_f1, 2),
        "per_class": per_class,
        "confusion_matrix": confusion.tolist(),
        "classes": classes
    }

def render_confusion_matrix_image(
    confusion_matrix: List[List[int]],
    classes: List[str],
    output_path: str
):
    """
    Renders an elegant confusion matrix heatmap visualization as PNG using PIL.
    """
    num_classes = len(classes)
    cell_size = 75
    left_margin = 150
    top_margin = 100
    bottom_margin = 60
    right_margin = 60

    img_w = left_margin + (num_classes * cell_size) + right_margin
    img_h = top_margin + (num_classes * cell_size) + bottom_margin

    img = Image.new("RGB", (img_w, img_h), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Title
    draw.text((left_margin, 20), "SmartHire Behavioral Model - Test Confusion Matrix", fill=(15, 23, 42))
    draw.text((left_margin, 45), "Rows: Ground Truth Actuals | Columns: Model Predictions", fill=(100, 116, 139))

    # Max val for color scaling
    max_val = max(max(row) for row in confusion_matrix) if confusion_matrix else 1

    # Draw Column Headers (Predictions)
    for col_idx, c_name in enumerate(classes):
        x = left_margin + (col_idx * cell_size) + (cell_size // 4)
        y = top_margin - 30
        short_name = c_name[:6]
        draw.text((x, y), short_name, fill=(30, 41, 59))

    # Draw Rows and Cells
    for row_idx, row in enumerate(confusion_matrix):
        # Row Header (True Class)
        y = top_margin + (row_idx * cell_size) + (cell_size // 3)
        draw.text((15, y), classes[row_idx][:14], fill=(30, 41, 59))

        for col_idx, val in enumerate(row):
            cx0 = left_margin + (col_idx * cell_size)
            cy0 = top_margin + (row_idx * cell_size)
            cx1 = cx0 + cell_size
            cy1 = cy0 + cell_size

            # Color intensity: True Positives (diagonal) get Indigo/Blue gradient, off-diagonals get subtle Amber/Rose
            intensity = min(1.0, max(0.05, val / max(1, max_val)))
            if row_idx == col_idx:
                # Indigo hue: rgb(99, 102, 241)
                r = int(240 - intensity * 150)
                g = int(245 - intensity * 150)
                b = int(255 - intensity * 20)
            else:
                if val > 0:
                    r = int(255)
                    g = int(245 - intensity * 120)
                    b = int(235 - intensity * 140)
                else:
                    r, g, b = 255, 255, 255

            draw.rectangle([cx0, cy0, cx1, cy1], fill=(r, g, b), outline=(226, 232, 240))
            text_val = str(val)
            text_color = (15, 23, 42) if intensity < 0.7 else (255, 255, 255)
            draw.text((cx0 + (cell_size // 3), cy0 + (cell_size // 3)), text_val, fill=text_color)

    img.save(output_path)
    print(f"[*] Confusion matrix visual chart rendered to: {output_path}")

def evaluate_best_model(checkpoint_path: Optional[str] = None) -> Dict[str, Any]:
    if not checkpoint_path:
        checkpoint_path = os.path.join(os.path.dirname(__file__), "models", "checkpoints", "best_behavior_model.pt")

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Trained model checkpoint not found at: {checkpoint_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Loading checkpoint: {checkpoint_path} onto {device}")

    ckpt = torch.load(checkpoint_path, map_location=device)
    classes = ckpt.get("classes", BEHAVIOR_CLASSES)
    num_classes = len(classes)

    model = SmartHireBehaviorCNN(num_classes=num_classes).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    dataset_root = find_dataset_root()
    data_info = get_data_loaders(
        dataset_root=dataset_root,
        batch_size=64,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        seed=42,
        num_workers=0
    )
    test_loader = data_info["test_loader"]

    y_true: List[int] = []
    y_pred: List[int] = []
    latencies: List[float] = []

    print(f"[*] Evaluating on {data_info['test_count']} unseen test images across {num_classes} classes...")
    start_eval = time.time()

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            t0 = time.time()
            outputs = model(images)
            t1 = time.time()

            latencies.append((t1 - t0) / images.size(0))
            _, preds = torch.max(outputs, 1)

            y_true.extend(labels.cpu().numpy().tolist())
            y_pred.extend(preds.cpu().numpy().tolist())

    total_eval_time = time.time() - start_eval
    avg_latency_ms = float(np.mean(latencies) * 1000.0) if latencies else 0.0
    fps = 1000.0 / avg_latency_ms if avg_latency_ms > 0 else 0.0

    metrics = compute_classification_metrics(np.array(y_true), np.array(y_pred), classes=classes)
    metrics["avg_latency_ms"] = round(avg_latency_ms, 2)
    metrics["inference_fps"] = round(fps, 1)
    metrics["model_version"] = ckpt.get("model_version", "smart-hire-behavior-v2.0")
    metrics["best_train_epoch"] = ckpt.get("epoch", 1)
    metrics["best_val_accuracy"] = ckpt.get("val_accuracy", 0.0)
    metrics["device"] = str(device)
    metrics["param_count"] = ckpt.get("param_count", 0)

    reports_dir = os.path.join(os.path.dirname(__file__), "reports")
    os.makedirs(reports_dir, exist_ok=True)

    out_metrics_file = os.path.join(reports_dir, "metrics.json")
    with open(out_metrics_file, "w") as f:
        json.dump(metrics, f, indent=2)

    cm_img_path = os.path.join(reports_dir, "confusion_matrix.png")
    render_confusion_matrix_image(metrics["confusion_matrix"], classes, cm_img_path)

    print("\n" + "="*60)
    print("FINAL TEST SET EVALUATION REPORT")
    print("="*60)
    print(f"Model Version:         {metrics['model_version']}")
    print(f"Test Accuracy:         {metrics['test_accuracy']}%")
    print(f"Macro Precision:       {metrics['macro_precision']}%")
    print(f"Weighted Precision:    {metrics['weighted_precision']}%")
    print(f"Macro Recall:          {metrics['macro_recall']}%")
    print(f"Weighted Recall:       {metrics['weighted_recall']}%")
    print(f"Macro F1-Score:        {metrics['macro_f1']}%")
    print(f"Weighted F1-Score:     {metrics['weighted_f1']}%")
    print(f"Avg Inference Latency: {metrics['avg_latency_ms']} ms ({metrics['inference_fps']} FPS)")

    print("\nPer-Class Breakdown:")
    print(f"  {'Class':<15} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Support':<8}")
    print("  " + "-"*60)
    for c_name, scores in metrics["per_class"].items():
        print(f"  {c_name:<15} | {scores['precision']:>9.2f}% | {scores['recall']:>9.2f}% | {scores['f1_score']:>9.2f}% | {scores['support']:>8}")

    print("\nConfusion Matrix (Rows: Ground Truth, Cols: Predicted):")
    print(f"  {'':<15} " + " ".join([f"{c[:6]:>7}" for c in classes]))
    for i, row in enumerate(metrics["confusion_matrix"]):
        print(f"  {classes[i]:<15} " + " ".join([f"{val:>7}" for val in row]))

    print(f"\nSaved evaluation metrics to: {out_metrics_file}")
    print(f"Saved confusion matrix plot: {cm_img_path}")
    print("="*60)

    return metrics

if __name__ == "__main__":
    evaluate_best_model()
