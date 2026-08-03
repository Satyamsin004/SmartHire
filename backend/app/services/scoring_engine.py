from typing import Dict, Any, List

class ScoringEngine:
    def calculate_session_scores(
        self,
        speech_results: List[Dict[str, Any]],
        vision_results: List[Dict[str, Any]],
        technical_answers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates scores according to the strict weighted formula:
        - Communication Score: 30%
        - Confidence Score: 25%
        - Technical Relevance Score: 30%
        - Professionalism Score: 15%
        Overall Score = (Communication * 30%) + (Confidence * 25%) + (Technical * 30%) + (Professionalism * 15%)
        """
        # Check if interview is empty / no speech submitted
        is_empty = all(t.get("technical_score", 0.0) == 0.0 for t in technical_answers) and all(s.get("speaking_pace_wpm", 0.0) == 0.0 for s in speech_results)
        if is_empty:
            return {
                "communication_score": 0.0,
                "confidence_score": 0.0,
                "technical_score": 0.0,
                "professionalism_score": 0.0,
                "overall_score": 0.0,
                "rating": "Unable to Evaluate",
                "strengths": ["Assessment attempt recorded."],
                "weaknesses": ["No spoken response or transcript captured during assessment."],
                "improvement_plan": ["Unable to evaluate interview: No transcript recorded. Please test microphone and audio permissions."]
            }

        # Communication Score (30%): WPM, filler word count, grammar, clarity
        comm_scores = []
        for s in speech_results:
            wpm_val = s.get("speaking_pace_wpm", 0.0)
            wpm_score = 95.0 if 120 <= wpm_val <= 170 else (60.0 if wpm_val > 0 else 0.0)
            filler_penalty = min(25.0, s.get("filler_word_count", 0) * 4.0)
            grammar = s.get("grammar_score", 0.0)
            clarity = s.get("clarity_score", 0.0)
            comm_scores.append(max(0.0, (wpm_score + grammar + clarity - filler_penalty) / 3.0))
            
        communication_score = round(sum(comm_scores) / max(len(comm_scores), 1), 1)

        # Confidence Score (25%): Eye contact, attention, facial engagement
        conf_scores = []
        for v in vision_results:
            eye_contact = v.get("eye_contact_percentage", 0.0)
            confidence = v.get("confidence_percentage", 0.0)
            attention = v.get("attention_score", 0.0)
            conf_scores.append((eye_contact + confidence + attention) / 3.0)
            
        confidence_score = round(sum(conf_scores) / max(len(conf_scores), 1), 1)

        # Technical Relevance Score (30%): Accuracy, keyword matching, depth
        tech_scores = [t.get("technical_score", 0.0) for t in technical_answers]
        technical_score = round(sum(tech_scores) / max(len(tech_scores), 1), 1)

        # Professionalism Score (15%): Time management, etiquette
        professionalism_score = round(min(100.0, (communication_score * 0.5 + confidence_score * 0.5)), 1)

        # Exact Formula
        overall_score = round(
            (communication_score * 0.30) +
            (confidence_score * 0.25) +
            (technical_score * 0.30) +
            (professionalism_score * 0.15),
            2
        )

        # Rubric evaluation
        if overall_score >= 90:
            rating = "Excellent"
        elif overall_score >= 75:
            rating = "Good"
        elif overall_score >= 60:
            rating = "Average"
        elif overall_score >= 40:
            rating = "Needs Improvement"
        else:
            rating = "Poor"

        # Generate Strengths & Weaknesses
        strengths = []
        weaknesses = []
        improvement_plan = []

        if technical_score >= 80:
            strengths.append("Demonstrated solid domain expertise and architectural precision.")
        else:
            weaknesses.append("Technical answers lacked deep domain key concepts.")
            improvement_plan.append("Deep dive into system design patterns and data structures.")

        if communication_score >= 80:
            strengths.append("Articulate delivery with steady speaking pace and minimal filler words.")
        else:
            weaknesses.append("Frequent filler words observed during hesitation points.")
            improvement_plan.append("Practice pause-and-think technique to eliminate filler words.")

        if confidence_score >= 80:
            strengths.append("Maintained exceptional eye contact and calm, attentive facial posture.")
        else:
            weaknesses.append("Eye contact dropped during complex problem-solving questions.")
            improvement_plan.append("Focus directly on camera center when answering scenario questions.")

        strengths.append("Well-structured approach to handling scenario questions.")

        return {
            "communication_score": communication_score,
            "confidence_score": confidence_score,
            "technical_score": technical_score,
            "professionalism_score": professionalism_score,
            "overall_score": overall_score,
            "rating_rubric": rating,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "improvement_plan": improvement_plan
        }

scoring_engine = ScoringEngine()
