import re
from typing import Dict, Any, List

FILLER_WORDS = {"um", "uh", "like", "you know", "basically", "actually", "literally", "sort of", "kind of", "so"}

class SpeechService:
    def analyze_speech(self, transcript: str, duration_seconds: float = 45.0) -> Dict[str, Any]:
        """Analyzes speech transcript for filler words, pace (WPM), grammar score, and vocabulary."""
        words = re.findall(r'\b\w+\b', transcript.lower())
        total_words = len(words)
        
        if total_words == 0:
            return {
                "speaking_pace_wpm": 0.0,
                "filler_word_count": 0,
                "filler_words": [],
                "grammar_score": 50.0,
                "vocabulary_richness": 50.0,
                "clarity_score": 50.0,
                "tone": "Silent"
            }

        # Filler words detection
        found_fillers = [w for w in words if w in FILLER_WORDS]
        filler_count = len(found_fillers)
        
        # Calculate WPM
        minutes = max(duration_seconds / 60.0, 0.1)
        wpm = round(total_words / minutes, 1)
        
        # Vocabulary richness (unique words / total words)
        unique_words = len(set(words))
        vocab_richness = min(100.0, round((unique_words / total_words) * 100 * 1.2, 1))
        
        # Grammar quality heuristic based on sentence structure & filler ratio
        filler_ratio = filler_count / total_words
        grammar_score = max(50.0, min(100.0, round((1.0 - filler_ratio * 2.5) * 100, 1)))
        
        # Clarity score based on optimal WPM range (130 - 165 WPM is ideal)
        if 130 <= wpm <= 165:
            clarity_score = 95.0
        elif 110 <= wpm < 130 or 165 < wpm <= 185:
            clarity_score = 85.0
        else:
            clarity_score = 70.0

        return {
            "speaking_pace_wpm": wpm,
            "filler_word_count": filler_count,
            "filler_words": list(set(found_fillers)),
            "grammar_score": grammar_score,
            "vocabulary_richness": vocab_richness,
            "clarity_score": clarity_score,
            "tone": "Confident & Professional" if grammar_score > 80 else "Hesitant"
        }

speech_service = SpeechService()
