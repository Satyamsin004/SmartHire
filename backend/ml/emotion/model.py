import torch
import torch.nn as nn
from typing import Dict, Any, List

BEHAVIOR_CLASSES = [
    "Looking away",
    "confident",
    "confused",
    "fear",
    "focused",
    "frustrated",
    "neutral",
    "unconfident"
]

class SmartHireBehaviorCNN(nn.Module):
    """
    Enterprise 8-Class Deep CNN architecture optimized for facial/behavioral analysis during remote interviews.
    Accepts 48x48 normalized facial crops, extracts hierarchical visual features with Batch Normalization
    and Spatial Dropout, and predicts probabilities across the 8 behavioral classes.
    """
    def __init__(self, num_classes: int = 8):
        super(SmartHireBehaviorCNN, self).__init__()
        self.num_classes = num_classes

        # Block 1 (48x48 -> 24x24)
        self.conv1_1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.bn1_1 = nn.BatchNorm2d(32)
        self.conv1_2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn1_2 = nn.BatchNorm2d(64)
        self.pool1 = nn.MaxPool2d(2, 2)
        self.drop1 = nn.Dropout2d(0.20)

        # Block 2 (24x24 -> 12x12)
        self.conv2_1 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn2_1 = nn.BatchNorm2d(128)
        self.conv2_2 = nn.Conv2d(128, 128, kernel_size=3, padding=1)
        self.bn2_2 = nn.BatchNorm2d(128)
        self.pool2 = nn.MaxPool2d(2, 2)
        self.drop2 = nn.Dropout2d(0.25)

        # Block 3 (12x12 -> 6x6)
        self.conv3_1 = nn.Conv2d(128, 256, kernel_size=3, padding=1)
        self.bn3_1 = nn.BatchNorm2d(256)
        self.conv3_2 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.bn3_2 = nn.BatchNorm2d(256)
        self.pool3 = nn.MaxPool2d(2, 2)
        self.drop3 = nn.Dropout2d(0.30)

        # Classifier (6x6x256 = 9216 -> 512 -> num_classes)
        self.relu = nn.ReLU(inplace=True)
        self.fc1 = nn.Linear(256 * 6 * 6, 512)
        self.bn_fc = nn.BatchNorm1d(512)
        self.drop_fc = nn.Dropout(0.50)
        self.fc2 = nn.Linear(512, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Block 1
        x = self.relu(self.bn1_1(self.conv1_1(x)))
        x = self.relu(self.bn1_2(self.conv1_2(x)))
        x = self.pool1(x)
        x = self.drop1(x)

        # Block 2
        x = self.relu(self.bn2_1(self.conv2_1(x)))
        x = self.relu(self.bn2_2(self.conv2_2(x)))
        x = self.pool2(x)
        x = self.drop2(x)

        # Block 3
        x = self.relu(self.bn3_1(self.conv3_1(x)))
        x = self.relu(self.bn3_2(self.conv3_2(x)))
        x = self.pool3(x)
        x = self.drop3(x)

        # Flatten & Dense Classifier
        x = x.view(x.size(0), -1)
        x = self.relu(self.bn_fc(self.fc1(x)))
        x = self.drop_fc(x)
        x = self.fc2(x)
        return x

def count_parameters(model: nn.Module) -> int:
    """Returns the total number of trainable model parameters."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

def get_model_config(classes: List[str] = None) -> Dict[str, Any]:
    cls_list = classes or BEHAVIOR_CLASSES
    return {
        "model_name": "SmartHireBehaviorCNN",
        "version": "smart-hire-behavior-v2.0",
        "input_channels": 1,
        "input_resolution": [48, 48],
        "num_classes": len(cls_list),
        "classes": cls_list,
        "normalization": {"mean": [0.5], "std": [0.5]}
    }
