import os
import pytest
import torch
import numpy as np
from PIL import Image

from ml.emotion.model import SmartHireBehaviorCNN, BEHAVIOR_CLASSES, count_parameters
from ml.emotion.validate_dataset import find_dataset_root, discover_classes
from ml.emotion.inference import EmotionInferenceEngine, DEFAULT_CHECKPOINT_PATH
from app.services.emotion_service import emotion_service

def test_dataset_discovery():
    root = find_dataset_root()
    assert os.path.exists(root), f"Dataset path does not exist: {root}"
    assert os.path.exists(os.path.join(root, "train")), "train folder missing"
    assert os.path.exists(os.path.join(root, "test")), "test folder missing"
    discovered = discover_classes(root)
    assert len(discovered) == 8, f"Expected 8 classes, found {len(discovered)}: {discovered}"
    for c in BEHAVIOR_CLASSES:
        assert os.path.exists(os.path.join(root, "train", c)), f"train/{c} missing"
        assert os.path.exists(os.path.join(root, "test", c)), f"test/{c} missing"

def test_model_architecture():
    model = SmartHireBehaviorCNN(num_classes=8)
    params = count_parameters(model)
    assert params > 1_000_000, f"Model has too few parameters: {params}"

    # Test forward pass with dummy tensor
    dummy = torch.randn(2, 1, 48, 48)
    out = model(dummy)
    assert out.shape == (2, 8), f"Unexpected output shape: {out.shape}"

def test_trained_checkpoint_loading():
    assert os.path.exists(DEFAULT_CHECKPOINT_PATH), f"Checkpoint not found at: {DEFAULT_CHECKPOINT_PATH}"
    ckpt = torch.load(DEFAULT_CHECKPOINT_PATH, map_location="cpu")
    assert "model_state_dict" in ckpt
    assert ckpt.get("model_version") == "smart-hire-behavior-v2.0"
    assert "val_accuracy" in ckpt
    assert ckpt["val_accuracy"] >= 50.0

def test_independent_inference_on_real_images():
    engine = EmotionInferenceEngine(model_path=DEFAULT_CHECKPOINT_PATH)
    root = find_dataset_root()

    # Test on a real confident image
    target_dir = os.path.join(root, "test", "confident")
    img_files = [f for f in os.listdir(target_dir) if f.endswith(".jpg")]
    assert len(img_files) > 0
    sample_path = os.path.join(target_dir, img_files[0])

    with Image.open(sample_path) as img:
        res = engine.predict_face_image(img)

    assert "dominant_emotion" in res
    assert "confidence" in res
    assert "probabilities" in res
    assert len(res["probabilities"]) == 8
    total_prob = sum(res["probabilities"].values())
    assert 99.0 <= total_prob <= 101.0
    assert res["model_version"] == "smart-hire-behavior-v2.0"

def test_no_face_handling():
    engine = EmotionInferenceEngine(model_path=DEFAULT_CHECKPOINT_PATH)
    res = engine.predict_face_image(None)
    assert res["dominant_emotion"] == "NO_FACE"
    assert res["confidence"] == 0.0

def test_temporal_smoothing_stabilization():
    engine = EmotionInferenceEngine(model_path=DEFAULT_CHECKPOINT_PATH)
    img = Image.new("L", (48, 48), color=128)

    # Feed 5 consecutive frames
    predictions = [engine.predict_face_image(img) for _ in range(5)]
    assert len(predictions) == 5
    for p in predictions:
        assert p["dominant_emotion"] in BEHAVIOR_CLASSES + ["UNCERTAIN", "NO_FACE"]

def test_emotion_service_aggregation():
    visual_obs = [
        {"timestamp": 5.0, "emotion": "neutral", "emotion_confidence": 0.85},
        {"timestamp": 15.0, "emotion": "neutral", "emotion_confidence": 0.88},
        {"timestamp": 35.0, "emotion": "confident", "emotion_confidence": 0.82},
        {"timestamp": 50.0, "emotion": "neutral", "emotion_confidence": 0.86}
    ]

    res = emotion_service.aggregate_session_emotions(visual_obs, duration_seconds=60.0)
    assert res["dominant_emotion"] == "neutral"
    assert res["emotion_distribution"]["neutral"] == 75.0
    assert res["emotion_distribution"]["confident"] == 25.0
    assert len(res["emotion_timeline"]) >= 2
