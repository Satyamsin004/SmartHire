import re
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("smarthire.speech_analyzer")

class SpeechAnalyzer:
    """Enterprise Evidence-Based Speech Analytics Engine.
    Performs deterministic grammar error analysis, exact filler word detection,
    pace (WPM) calculation, acoustic clarity evaluation, and response hesitation measurement.
    """

    FILLER_LEXICON = [
        "you know", "sort of", "kind of", "i mean",
        "um", "uh", "umm", "hmm", "like", "basically", "actually", "literally"
    ]

    GRAMMAR_PATTERNS = [
        (r"\b(i)\s+(is|has|was worked|was went)\b", "Subject-verb / auxiliary agreement error", "I am / I have"),
        (r"\b(he|she|it)\s+(have|are|were|do|don't)\b", "Singular third-person subject-verb disagreement", "has / is / was / does / doesn't"),
        (r"\b(we|they|you)\s+(is|was|has|does)\b", "Plural subject-verb disagreement", "are / were / have / do"),
        (r"\b(am|is|are|was|were)\s+([a-z]+ed)\s+(to|on|with|by|in)\b", "Improper passive/past-participle combination", "active verb phrase"),
        (r"\b(did|didn't)\s+([a-z]+ed|went|saw|came|had|took)\b", "Double past-tense usage with auxiliary 'did'", "base form verb (e.g. did go, did see)"),
        (r"\b(have|has|had)\s+(went|saw|did|took|wrote|broke)\b", "Past simple used instead of past participle with have/has/had", "past participle (e.g. have gone, have seen)"),
        (r"\b(more\s+better|more\s+easier|most\s+best|most\s+greatest)\b", "Double comparative/superlative error", "better / easier / best / greatest"),
        (r"\b([a-zA-Z]+)\s+\1\b", "Accidental immediate word repetition", "single instance")
    ]

    def analyze_full_session(
        self,
        transcript_segments: List[Dict[str, Any]],
        total_duration_seconds: float = 0.0
    ) -> Dict[str, Any]:
        """Analyzes all candidate transcript segments and produces comprehensive deterministic speech metrics."""
        candidate_segments = [s for s in transcript_segments if (s.get("speaker") or "CANDIDATE").upper() == "CANDIDATE"]
        
        full_text = " ".join([s.get("text", "") for s in candidate_segments]).strip()
        words = re.findall(r"\b[a-zA-Z']+\b", full_text.lower())
        total_words = len(words)

        if total_words == 0:
            return self._empty_metrics()

        # 1. Speaking Duration & Pace (WPM)
        speaking_duration = sum(float(s.get("duration") or s.get("end_time", 0) - s.get("start_time", 0)) for s in candidate_segments)
        if speaking_duration <= 0.0 and total_duration_seconds > 0.0:
            speaking_duration = total_duration_seconds
        speaking_duration = max(speaking_duration, 5.0)

        duration_minutes = speaking_duration / 60.0
        avg_wpm = round(total_words / max(duration_minutes, 0.05), 1)

        # Calculate per-response WPMs for min/max
        per_response_wpms = []
        for s in candidate_segments:
            seg_text = s.get("text", "")
            seg_words = len(re.findall(r"\b[a-zA-Z']+\b", seg_text.lower()))
            seg_dur = float(s.get("duration") or (s.get("end_time", 0) - s.get("start_time", 0)) or 10.0)
            if seg_words > 0 and seg_dur > 1.0:
                per_response_wpms.append(round(seg_words / (seg_dur / 60.0), 1))

        min_wpm = min(per_response_wpms) if per_response_wpms else avg_wpm
        max_wpm = max(per_response_wpms) if per_response_wpms else avg_wpm

        # WPM Classification
        if 120 <= avg_wpm <= 165:
            wpm_class = "Comfortable"
            pace_score = 95.0
        elif 165 < avg_wpm <= 190:
            wpm_class = "Fast"
            pace_score = 82.0
        elif avg_wpm > 190:
            wpm_class = "Very Fast"
            pace_score = 65.0
        elif 100 <= avg_wpm < 120:
            wpm_class = "Controlled / Deliberate"
            pace_score = 88.0
        else:
            wpm_class = "Slow"
            pace_score = 60.0

        # 2. Filler Words Detection
        filler_events = []
        filler_counts: Dict[str, int] = {}
        total_fillers = 0

        # Check multi-word and single-word fillers
        lower_full_text = full_text.lower()
        for filler in self.FILLER_LEXICON:
            pattern = rf"\b{re.escape(filler)}\b"
            matches = list(re.finditer(pattern, lower_full_text))
            count = len(matches)
            if count > 0:
                filler_counts[filler] = count
                total_fillers += count

        # Assign filler events to specific segments
        for seg in candidate_segments:
            seg_text_lower = (seg.get("text") or "").lower()
            seg_start = float(seg.get("start_time") or 0.0)
            for filler in self.FILLER_LEXICON:
                matches = list(re.finditer(rf"\b{re.escape(filler)}\b", seg_text_lower))
                for m in matches:
                    filler_events.append({
                        "word": filler,
                        "timestamp": round(seg_start + (m.start() / max(1, len(seg_text_lower))) * float(seg.get("duration") or 10.0), 1),
                        "segment_id": seg.get("id"),
                        "sequence_number": seg.get("sequence_number", 1)
                    })

        filler_rate = round((total_fillers / max(1, total_words)) * 100, 1)
        # Filler control score (100% when 0 fillers, down to 50 when filler_rate is high)
        filler_control_score = max(40.0, min(100.0, round(100.0 - (filler_rate * 6.5), 1)))

        # 3. Grammar Error Analysis
        grammar_errors_sample = []
        grammar_error_count = 0

        for pattern, issue_type, suggestion in self.GRAMMAR_PATTERNS:
            matches = list(re.finditer(pattern, full_text, re.IGNORECASE))
            for m in matches:
                grammar_error_count += 1
                if len(grammar_errors_sample) < 6:
                    snippet = full_text[max(0, m.start() - 15):min(len(full_text), m.end() + 15)].strip()
                    grammar_errors_sample.append({
                        "issue_type": issue_type,
                        "matched_text": m.group(0),
                        "context_snippet": f"...{snippet}...",
                        "suggestion": suggestion
                    })

        grammar_error_rate = round((grammar_error_count / max(1, total_words)) * 100, 1)
        grammar_score = max(40.0, min(100.0, round(100.0 - (grammar_error_rate * 9.0), 1)))

        # 4. Speech Clarity & Vocabulary Richness
        unique_words = len(set(words))
        vocabulary_richness = round(min(100.0, (unique_words / max(1, total_words)) * 135.0), 1)

        # Average segment ASR confidence
        confidences = [float(s.get("confidence", 0.90)) for s in candidate_segments if s.get("confidence") is not None]
        avg_confidence = (sum(confidences) / len(confidences)) if confidences else 0.90
        
        clarity_score = round(
            min(100.0, max(40.0, (avg_confidence * 60.0) + (pace_score * 0.25) + (filler_control_score * 0.15))),
            1
        )

        # 5. Hesitation & Pauses
        pause_count = 0
        long_pause_count = 0
        total_pause_duration = 0.0
        latencies = []

        for i in range(len(transcript_segments) - 1):
            curr_seg = transcript_segments[i]
            next_seg = transcript_segments[i + 1]
            gap = float(next_seg.get("start_time", 0.0)) - float(curr_seg.get("end_time", 0.0))
            if gap > 0.6:
                pause_count += 1
                total_pause_duration += gap
                if gap >= 2.0:
                    long_pause_count += 1

            if (curr_seg.get("speaker") or "").upper() == "AI_INTERVIEWER" and (next_seg.get("speaker") or "").upper() == "CANDIDATE":
                latency = max(0.2, gap)
                latencies.append(latency)

        avg_pause_duration = round(total_pause_duration / max(1, pause_count), 2)
        response_latency_avg = round(sum(latencies) / max(1, len(latencies)), 2) if latencies else 1.5

        # Pronunciation assessment (from acoustic clarity)
        pronunciation_score = round(min(100.0, max(50.0, clarity_score * 0.95 + 4.0)), 1)

        return {
            "total_words": total_words,
            "speaking_duration": round(speaking_duration, 1),
            "average_wpm": avg_wpm,
            "min_wpm": min_wpm,
            "max_wpm": max_wpm,
            "wpm_classification": wpm_class,
            "pace_score": pace_score,
            "filler_count": total_fillers,
            "filler_rate": filler_rate,
            "filler_breakdown": filler_counts,
            "filler_events": filler_events,
            "filler_control_score": filler_control_score,
            "grammar_error_count": grammar_error_count,
            "grammar_error_rate": grammar_error_rate,
            "grammar_errors_sample": grammar_errors_sample,
            "grammar_score": grammar_score,
            "vocabulary_richness": vocabulary_richness,
            "clarity_score": clarity_score,
            "pronunciation_score": pronunciation_score,
            "pronunciation_status": "Articulate & Clear" if pronunciation_score >= 80 else "Satisfactory",
            "pause_count": pause_count,
            "long_pause_count": long_pause_count,
            "average_pause_duration": avg_pause_duration,
            "response_latency_avg": response_latency_avg
        }

    def _empty_metrics(self) -> Dict[str, Any]:
        return {
            "total_words": 0,
            "speaking_duration": 0.0,
            "average_wpm": 0.0,
            "min_wpm": 0.0,
            "max_wpm": 0.0,
            "wpm_classification": "Silent",
            "pace_score": 0.0,
            "filler_count": 0,
            "filler_rate": 0.0,
            "filler_breakdown": {},
            "filler_events": [],
            "filler_control_score": 0.0,
            "grammar_error_count": 0,
            "grammar_error_rate": 0.0,
            "grammar_errors_sample": [],
            "grammar_score": 0.0,
            "vocabulary_richness": 0.0,
            "clarity_score": 0.0,
            "pronunciation_score": None,
            "pronunciation_status": "Insufficient audio data",
            "pause_count": 0,
            "long_pause_count": 0,
            "average_pause_duration": 0.0,
            "response_latency_avg": 0.0
        }

speech_analyzer = SpeechAnalyzer()
