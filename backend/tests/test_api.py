import pytest
from app.services.scoring_engine import scoring_engine
from app.services.speech_service import speech_service
from app.services.vision_service import vision_service
from app.services.resume_service import resume_service

def test_speech_analysis():
    result = speech_service.analyze_speech("In our architecture we used Redis and FastAPI um basically like", 45.0)
    assert result["filler_word_count"] >= 2
    assert result["speaking_pace_wpm"] > 0

def test_scoring_formula():
    scores = scoring_engine.calculate_session_scores(
        speech_results=[{"speaking_pace_wpm": 145.0, "filler_word_count": 1, "grammar_score": 90.0, "clarity_score": 95.0}],
        vision_results=[{"eye_contact_percentage": 90.0, "confidence_percentage": 90.0, "attention_score": 90.0}],
        technical_answers=[{"technical_score": 90.0}]
    )
    # Expected overall = (Comm*0.3) + (Conf*0.25) + (Tech*0.3) + (Prof*0.15)
    assert "overall_score" in scores
    assert scores["overall_score"] >= 80.0

def test_resume_parser():
    parsed = resume_service.parse_resume_text("Experienced React TypeScript FastAPI developer with PostgreSQL and Docker")
    assert parsed["ats_score"] > 70.0
    assert len(parsed["skills"]) >= 3
