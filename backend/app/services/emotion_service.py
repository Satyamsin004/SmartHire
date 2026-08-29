import os
import logging
from typing import Dict, Any, List, Optional
from ml.emotion.inference import EmotionInferenceEngine
from ml.emotion.model import BEHAVIOR_CLASSES

logger = logging.getLogger("smarthire.emotion_service")

class EmotionService:
    """Enterprise Behavioral & Facial Analytics Service.
    Evaluates candidate webcam observations using behavioral CNN inference,
    temporal rolling window smoothing, and non-invasive evidence-aware language.
    """

    def __init__(self):
        self.engine = EmotionInferenceEngine()
        self.classes = BEHAVIOR_CLASSES

    def aggregate_session_emotions(
        self,
        visual_observations: List[Dict[str, Any]],
        duration_seconds: float = 0.0
    ) -> Dict[str, Any]:
        """Aggregates time-series visual observations into a smooth behavioral distribution and chronological timeline."""
        if not visual_observations:
            return {
                "dominant_emotion": "neutral",
                "emotion_distribution": {e: (100.0 if e == "neutral" else 0.0) for e in self.classes},
                "emotion_timeline": [
                    {
                        "start_time": 0.0,
                        "end_time": round(max(duration_seconds, 60.0), 1),
                        "dominant_emotion": "neutral",
                        "confidence": 0.85,
                        "observation_note": "No candidate facial observations recorded during this session."
                    }
                ]
            }

        # Count frequencies
        behavior_counts: Dict[str, int] = {e: 0 for e in self.classes}
        total_obs = len(visual_observations)

        LEGACY_EMOTION_MAP = {
            "surprise": "confused",
            "surprised": "confused",
            "happy": "confident",
            "sad": "unconfident",
            "angry": "frustrated",
            "disgust": "confused",
            "calm": "neutral",
            "focused / calm": "focused",
            "calm & confident": "confident"
        }

        timeline = []
        current_block: Optional[Dict[str, Any]] = None

        for obs in visual_observations:
            raw_emo = (obs.get("emotion") or "neutral").strip().lower()
            if raw_emo in LEGACY_EMOTION_MAP:
                raw_emo = LEGACY_EMOTION_MAP[raw_emo]

            matched = next((c for c in self.classes if c.lower() == raw_emo), "neutral")
            emo = matched
            behavior_counts[emo] += 1

            ts = float(obs.get("timestamp", 0.0))
            conf = float(obs.get("emotion_confidence", 0.90))

            if not current_block:
                current_block = {
                    "start_time": ts,
                    "end_time": ts + 10.0,
                    "dominant_emotion": emo,
                    "confidence": conf
                }
            elif current_block["dominant_emotion"] == emo:
                current_block["end_time"] = ts + 10.0
            else:
                # Close block and start new
                current_block["observation_note"] = f"Facial-analysis model observed an elevated probability of a {current_block['dominant_emotion'].lower()}-associated facial state."
                timeline.append(current_block)
                current_block = {
                    "start_time": ts,
                    "end_time": ts + 10.0,
                    "dominant_emotion": emo,
                    "confidence": conf
                }

        if current_block:
            current_block["observation_note"] = f"Facial-analysis model observed an elevated probability of a {current_block['dominant_emotion'].lower()}-associated facial state."
            timeline.append(current_block)

        # Distribution %
        distribution = {}
        for emo, count in behavior_counts.items():
            distribution[emo] = round((count / max(1, total_obs)) * 100.0, 1)

        dominant_overall = max(distribution, key=distribution.get)

        return {
            "dominant_emotion": dominant_overall,
            "emotion_distribution": distribution,
            "emotion_timeline": timeline
        }

emotion_service = EmotionService()
