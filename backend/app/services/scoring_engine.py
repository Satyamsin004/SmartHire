import logging
from typing import Dict, Any, List, Optional

from app.services.speech_analyzer import speech_analyzer
from app.services.technical_evaluator import technical_evaluator
from app.services.gaze_analyzer import gaze_analyzer
from app.services.emotion_service import emotion_service
from app.services.feedback_generator import feedback_generator

logger = logging.getLogger("smarthire.scoring_engine")

class ScoringEngine:
    """Enterprise Deterministic Scoring Engine.
    Executes verifiable mathematical scoring formulas based strictly on stored evidence.
    Weights: Communication (30%), Confidence (25%), Technical (30%), Professionalism (15%).
    """

    WEIGHTS = {
        "communication": 0.30,
        "confidence": 0.25,
        "technical": 0.30,
        "professionalism": 0.15
    }

    @staticmethod
    def calculate_rating_category(score: float) -> Dict[str, str]:
        """Maps overall score to official performance rating categories and recommendation."""
        if score >= 90.0:
            return {"rating_category": "Excellent", "recommendation": "Shortlist"}
        elif score >= 75.0:
            return {"rating_category": "Good", "recommendation": "Shortlist"}
        elif score >= 60.0:
            return {"rating_category": "Average", "recommendation": "Hold"}
        elif score >= 40.0:
            return {"rating_category": "Needs Improvement", "recommendation": "Hold"}
        else:
            return {"rating_category": "Poor", "recommendation": "Reject"}

    async def calculate_session_scores(
        self,
        speech_results: List[Dict[str, Any]],
        vision_results: List[Dict[str, Any]],
        technical_answers: List[Dict[str, Any]],
        transcripts: List[str],
        session_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Calculates authentic evidence-based interview scores using specialized analyzers."""
        info = session_info or {}
        role = info.get("role_target", "Software Engineer")
        total_duration = float(info.get("duration_minutes", 15) * 60)

        # 1. Build or normalize transcript segments
        raw_segments = info.get("transcript_segments") or []
        if not raw_segments and transcripts:
            # Construct synthetic segment representations from answers
            raw_segments = []
            for i, t in enumerate(transcripts):
                raw_segments.append({
                    "id": f"seg_{i+1}",
                    "speaker": "CANDIDATE",
                    "text": t,
                    "start_time": i * 60.0,
                    "end_time": (i * 60.0) + 45.0,
                    "duration": 45.0,
                    "sequence_number": i + 1,
                    "confidence": 0.92
                })

        # 2. Run Speech Analytics
        speech_analysis = speech_analyzer.analyze_full_session(raw_segments, total_duration)

        # 3. Run Gaze, Eye-Tracking & Visual Analytics
        raw_observations = info.get("visual_observations") or []
        gaze_analysis = gaze_analyzer.analyze_session_gaze(raw_observations, total_duration)
        emotion_analysis = emotion_service.aggregate_session_emotions(raw_observations, total_duration)

        # 4. Run Question-Specific Technical Evaluation
        questions_list = info.get("questions") or []
        normalized_questions = []
        for idx, q in enumerate(questions_list):
            if isinstance(q, dict):
                normalized_questions.append(q)
            else:
                normalized_questions.append({
                    "id": f"q_{idx+1}",
                    "question_text": str(q),
                    "category": info.get("round_type", "Technical"),
                    "difficulty": info.get("difficulty", "Medium"),
                    "expected_keywords": ["Architecture", "Scalability", "State Management", "Performance", "Optimization"]
                })

        tech_analysis = technical_evaluator.evaluate_answers(normalized_questions, technical_answers)

        # 5. Deterministic Communication Submetric Calculations
        clarity = speech_analysis["clarity_score"]
        grammar = speech_analysis["grammar_score"]
        filler_ctrl = speech_analysis["filler_control_score"]
        pace = speech_analysis["pace_score"]
        vocab = speech_analysis["vocabulary_richness"]
        pronun = speech_analysis["pronunciation_score"] if speech_analysis["pronunciation_score"] is not None else 80.0
        tech_completeness = tech_analysis["completeness"]

        comm_score_raw = (
            (clarity * 0.25) +
            (grammar * 0.20) +
            (filler_ctrl * 0.15) +
            (pace * 0.15) +
            (vocab * 0.10) +
            (tech_completeness * 0.10) +
            (pronun * 0.05)
        )
        comm_score = round(max(0.0, min(100.0, comm_score_raw)), 1)

        # 6. Deterministic Confidence Submetric Calculations
        eye_contact = gaze_analysis["eye_contact_ratio"]
        attention = gaze_analysis["attention_score"]
        facial_eng = gaze_analysis["engagement_score"]
        hesitation_ctrl = round(max(20.0, min(100.0, 100.0 - (speech_analysis["response_latency_avg"] * 12.0) - (speech_analysis["long_pause_count"] * 5.0))), 1)
        speech_stab = gaze_analysis["head_pose_stability"]

        conf_score_raw = (
            (eye_contact * 0.30) +
            (facial_eng * 0.20) +
            (hesitation_ctrl * 0.20) +
            (speech_stab * 0.15) +
            (attention * 0.15)
        )
        conf_score = round(max(0.0, min(100.0, conf_score_raw)), 1)

        # 7. Deterministic Technical Relevance Submetric Calculations
        tech_score = round(max(0.0, min(100.0, tech_analysis["technical_score"])), 1)

        # 8. Deterministic Professionalism Submetric Calculations
        time_mgmt = round(min(100.0, max(40.0, 100.0 - abs(140.0 - speech_analysis["average_wpm"]) * 0.5)), 1)
        org = round(min(100.0, max(40.0, tech_analysis["problem_solving"] * 0.7 + tech_completeness * 0.3)), 1)
        prof_comm = round((comm_score * 0.6) + (grammar * 0.4), 1)
        etiquette = 95.0 if gaze_analysis["face_presence_ratio"] >= 90.0 else 75.0
        consistency = round((gaze_analysis["head_pose_stability"] * 0.5) + (speech_analysis["pace_score"] * 0.5), 1)

        prof_score_raw = (
            (time_mgmt * 0.20) +
            (org * 0.25) +
            (prof_comm * 0.25) +
            (etiquette * 0.15) +
            (consistency * 0.15)
        )
        prof_score = round(max(0.0, min(100.0, prof_score_raw)), 1)

        # 9. Exact Weighted Overall Score: 30% Comm + 25% Conf + 30% Tech + 15% Prof
        overall_score_raw = (
            (comm_score * self.WEIGHTS["communication"]) +
            (conf_score * self.WEIGHTS["confidence"]) +
            (tech_score * self.WEIGHTS["technical"]) +
            (prof_score * self.WEIGHTS["professionalism"])
        )
        overall_score = round(max(0.0, min(100.0, overall_score_raw)), 1)
        rating_meta = self.calculate_rating_category(overall_score)

        # 10. Generate Evidence-Backed Feedback & Curated Resources
        feedback = feedback_generator.generate_feedback(
            speech_metrics=speech_analysis,
            visual_metrics=gaze_analysis,
            technical_metrics=tech_analysis,
            overall_score=overall_score,
            role_target=role
        )

        # Build timeline visual structures
        speech_timeline = [
            {"order_index": i + 1, "wpm": q.get("speaking_pace_wpm", speech_analysis["average_wpm"]), "filler_count": speech_analysis["filler_count"] // max(1, len(technical_answers))}
            for i, q in enumerate(technical_answers)
        ] if technical_answers else []

        communication_metrics = {
            "score": comm_score,
            "grammar": grammar,
            "grammar_error_count": speech_analysis["grammar_error_count"],
            "grammar_error_rate": speech_analysis["grammar_error_rate"],
            "grammar_errors_sample": speech_analysis["grammar_errors_sample"],
            "clarity": clarity,
            "fluency": round((filler_ctrl * 0.6) + (pace * 0.4), 1),
            "speaking_pace_wpm": speech_analysis["average_wpm"],
            "wpm_classification": speech_analysis["wpm_classification"],
            "filler_words": speech_analysis["filler_count"],
            "filler_rate": speech_analysis["filler_rate"],
            "filler_breakdown": speech_analysis["filler_breakdown"],
            "pronunciation": speech_analysis["pronunciation_score"],
            "pronunciation_status": speech_analysis["pronunciation_status"],
            "vocabulary": vocab,
            "response_completeness": tech_completeness
        }

        confidence_metrics = {
            "score": conf_score,
            "eye_contact": eye_contact,
            "camera_facing": gaze_analysis["camera_facing_ratio"],
            "away_ratio": gaze_analysis["away_ratio"],
            "attention": attention,
            "attention_status": gaze_analysis["attention_status"],
            "hesitation_control": hesitation_ctrl,
            "response_latency_avg": speech_analysis["response_latency_avg"],
            "long_pause_count": speech_analysis["long_pause_count"],
            "facial_engagement": facial_eng,
            "dominant_emotion": emotion_analysis["dominant_emotion"],
            "emotion_distribution": emotion_analysis["emotion_distribution"],
            "head_pose_stability": gaze_analysis["head_pose_stability"]
        }

        technical_metrics = {
            "score": tech_score,
            "accuracy": tech_analysis["accuracy"],
            "concept_relevance": tech_analysis["concept_relevance"],
            "problem_solving": tech_analysis["problem_solving"],
            "domain_knowledge": tech_analysis["domain_knowledge"],
            "completeness": tech_analysis["completeness"],
            "covered_topics": tech_analysis["covered_topics"],
            "missing_topics": tech_analysis["missing_topics"]
        }

        professionalism_metrics = {
            "score": prof_score,
            "time_management": time_mgmt,
            "organization": org,
            "professional_communication": prof_comm,
            "interview_etiquette": etiquette,
            "consistency": consistency
        }

        return {
            "communication_score": comm_score,
            "confidence_score": conf_score,
            "technical_score": tech_score,
            "professionalism_score": prof_score,
            "overall_score": overall_score,
            "rating": rating_meta["rating_category"],
            "rating_rubric": rating_meta["rating_category"],
            "recommendation": rating_meta["recommendation"],
            "communication_metrics": communication_metrics,
            "confidence_metrics": confidence_metrics,
            "technical_metrics": technical_metrics,
            "professionalism_metrics": professionalism_metrics,
            "question_evaluations": tech_analysis["question_evaluations"],
            "strengths": feedback["strengths"],
            "weaknesses": feedback["weaknesses"],
            "improvement_plan": feedback["improvement_plan"],
            "practice_recommendations": feedback["practice_recommendations"],
            "learning_resources": feedback["learning_resources"],
            "missing_topics": tech_analysis["missing_topics"],
            "speech_timeline": speech_timeline,
            "gaze_timeline": gaze_analysis["gaze_timeline"],
            "emotion_timeline": emotion_analysis["emotion_timeline"],
            "model_version": "smart-hire-v2.0.0",
            "analysis_version": "evidence_based_v2",
            "overall_summary": f"The candidate achieved an overall evidence-based score of {overall_score}/100 ({rating_meta['rating_category']}) across technical accuracy ({tech_score}%), communication quality ({comm_score}%), and interview engagement ({conf_score}%)."
        }

scoring_engine = ScoringEngine()
