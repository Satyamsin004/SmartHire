import os
import sys
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from typing import Dict, Any, List, Optional

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ml.emotion.model import SmartHireBehaviorCNN, BEHAVIOR_CLASSES

DEFAULT_CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "models", "checkpoints", "best_behavior_model.pt")
FALLBACK_CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "models", "checkpoints", "smarthire_behavior_v2.pth")

class EmotionInferenceEngine:
    """
    Production Inference Engine for 8-Class Facial & Behavioral Expression Recognition.
    Applies exponential moving average (EMA) temporal smoothing to prevent frame-to-frame flickering.
    Employs evidence-aware non-invasive behavioral language.
    """
    def __init__(self, model_path: Optional[str] = None, confidence_threshold: float = 0.20):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.classes = BEHAVIOR_CLASSES
        self.num_classes = len(self.classes)
        self.confidence_threshold = confidence_threshold
        self.model_version = "smart-hire-behavior-v2.0"

        self.model = SmartHireBehaviorCNN(num_classes=self.num_classes).to(self.device)
        self.model.eval()

        target_ckpt = model_path or DEFAULT_CHECKPOINT_PATH
        if not os.path.exists(target_ckpt) and os.path.exists(FALLBACK_CHECKPOINT_PATH):
            target_ckpt = FALLBACK_CHECKPOINT_PATH

        if os.path.exists(target_ckpt):
            try:
                ckpt = torch.load(target_ckpt, map_location=self.device)
                if "classes" in ckpt:
                    self.classes = ckpt["classes"]
                    self.num_classes = len(self.classes)
                    self.model = SmartHireBehaviorCNN(num_classes=self.num_classes).to(self.device)
                    self.model.eval()

                state_dict = ckpt.get('model_state_dict', ckpt)
                self.model.load_state_dict(state_dict)
                self.model_version = ckpt.get('model_version', self.model_version)
                print(f"[*] Successfully loaded trained behavioral checkpoint: {target_ckpt} (Version: {self.model_version})")
            except Exception as e:
                print(f"[!] Warning: Error loading checkpoint {target_ckpt} ({e}), running in untrained mode.")
        else:
            print(f"[!] Warning: Checkpoint not found at {target_ckpt}.")

        self.rolling_history: List[Dict[str, float]] = []
        self.history_window_size = 5

    def _preprocess_image(self, pil_image: Image.Image) -> torch.Tensor:
        """Converts PIL Image to grayscale 48x48 normalized tensor in [-1.0, 1.0]."""
        gray = pil_image.convert('L')
        if gray.size != (48, 48):
            gray = gray.resize((48, 48), resample=Image.BILINEAR)
        arr = np.array(gray, dtype=np.float32) / 255.0
        arr = (arr - 0.5) / 0.5
        tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0).to(self.device)
        return tensor

    def predict_face_image(self, pil_image: Optional[Image.Image]) -> Dict[str, Any]:
        """
        Runs real neural network inference on a cropped candidate face.
        Returns smoothed probability distribution and evidence-aware observation notes.
        """
        if pil_image is None:
            return {
                "dominant_emotion": "NO_FACE",
                "confidence": 0.0,
                "probabilities": {c: 0.0 for c in self.classes},
                "observation_note": "No candidate face detected in camera frame.",
                "model_version": self.model_version
            }

        try:
            tensor = self._preprocess_image(pil_image)
            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()

            raw_dist = {self.classes[i]: float(probs[i]) for i in range(len(self.classes))}
            self.rolling_history.append(raw_dist)
            if len(self.rolling_history) > self.history_window_size:
                self.rolling_history.pop(0)

            # Temporal Exponential Moving Average smoothing
            smoothed_dist = {}
            for cls_name in self.classes:
                smoothed_dist[cls_name] = float(np.mean([h[cls_name] for h in self.rolling_history]))

            # Normalize smoothed distribution to sum to 100%
            total = sum(smoothed_dist.values()) or 1.0
            for cls_name in self.classes:
                smoothed_dist[cls_name] = round((smoothed_dist[cls_name] / total) * 100.0, 1)

            dominant_cls = max(smoothed_dist, key=smoothed_dist.get)
            confidence = round(smoothed_dist[dominant_cls] / 100.0, 2)

            if confidence < self.confidence_threshold:
                dominant_cls = "UNCERTAIN"
                note = "Facial-behavior model observed balanced probabilities across multiple expression categories."
            else:
                note = f"The facial-analysis model observed an elevated probability of a {dominant_cls.lower()}-associated facial state."

            return {
                "dominant_emotion": dominant_cls,
                "confidence": confidence,
                "probabilities": smoothed_dist,
                "observation_note": note,
                "model_version": self.model_version
            }
        except Exception as e:
            return {
                "dominant_emotion": "ANALYSIS_UNAVAILABLE",
                "confidence": 0.0,
                "probabilities": {c: 0.0 for c in self.classes},
                "observation_note": f"Behavioral analysis encountered an error: {str(e)}",
                "model_version": self.model_version
            }

# Global singleton instance loaded once at application startup
emotion_inference_engine = EmotionInferenceEngine()
