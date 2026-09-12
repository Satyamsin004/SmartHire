import pytest
from app.services.scoring_engine import ScoringEngine
from app.services.resume_service import resume_service

@pytest.mark.asyncio
async def test_scoring_variations_a_through_h():
    """
    Verify scoring with:
    A. Raw transcript arrays
    B. Empty transcript
    C. None transcript
    D. Pre-aggregated speech metrics
    E. Missing optional metrics
    F. Zero scores
    G. Maximum scores
    H. Partial evaluation data
    """
    engine = ScoringEngine()

    # Fixed deterministic weights check
    assert engine.WEIGHTS["communication"] == 0.30
    assert engine.WEIGHTS["confidence"] == 0.25
    assert engine.WEIGHTS["technical"] == 0.30
    assert engine.WEIGHTS["professionalism"] == 0.15

    # Case A: Raw transcript arrays
    scores_a = await engine.calculate_session_scores(
        speech_results=[{"speaking_pace_wpm": 135.0, "filler_word_count": 1, "grammar_score": 90.0, "clarity_score": 92.0}],
        vision_results=[{"eye_contact_percentage": 88.0, "confidence_percentage": 85.0, "attention_score": 90.0}],
        technical_answers=[{"technical_score": 85.0, "problem_solving": 80.0, "completeness": 85.0, "domain_knowledge": 85.0}],
        transcripts=["We implement a fault-tolerant microservices architecture using gRPC and Kafka."],
        session_info={"duration_minutes": 15, "role_target": "Backend Engineer"}
    )
    assert scores_a["overall_score"] > 0.0
    assert scores_a["communication_score"] > 0
    assert scores_a["confidence_score"] > 0
    assert scores_a["technical_score"] > 0
    assert scores_a["professionalism_score"] > 0

    # Case B: Empty transcript
    scores_b = await engine.calculate_session_scores(
        speech_results=[],
        vision_results=[],
        technical_answers=[],
        transcripts=[],
        session_info={"duration_minutes": 15}
    )
    assert scores_b["overall_score"] >= 0.0

    # Case C: None transcript
    scores_c = await engine.calculate_session_scores(
        speech_results=[{"speaking_pace_wpm": 120.0, "filler_word_count": 0, "grammar_score": 85.0, "clarity_score": 85.0}],
        vision_results=[{"eye_contact_percentage": 80.0, "confidence_percentage": 80.0, "attention_score": 80.0}],
        technical_answers=[{"technical_score": 80.0}],
        transcripts=None,
        session_info={"duration_minutes": 15}
    )
    assert scores_c["overall_score"] > 0.0

    # Case D: Pre-aggregated speech metrics (no raw transcripts, rich speech results)
    scores_d = await engine.calculate_session_scores(
        speech_results=[{
            "speaking_pace_wpm": 140.0,
            "filler_word_count": 0,
            "grammar_score": 95.0,
            "clarity_score": 98.0,
            "vocabulary_richness": 90.0
        }],
        vision_results=[{
            "eye_contact_percentage": 95.0,
            "confidence_percentage": 92.0,
            "attention_score": 94.0
        }],
        technical_answers=[{
            "technical_score": 92.0,
            "problem_solving": 90.0,
            "completeness": 92.0,
            "domain_knowledge": 94.0
        }],
        transcripts=None,
        session_info={"duration_minutes": 20}
    )
    assert scores_d["overall_score"] >= 85.0

    # Case E: Missing optional metrics
    scores_e = await engine.calculate_session_scores(
        speech_results=[{}],
        vision_results=[{}],
        technical_answers=[{}],
        transcripts=None,
        session_info=None
    )
    assert scores_e["overall_score"] >= 0.0

    # Case F: Zero scores
    scores_f = await engine.calculate_session_scores(
        speech_results=[{"speaking_pace_wpm": 0.0, "filler_word_count": 20, "grammar_score": 0.0, "clarity_score": 0.0}],
        vision_results=[{"eye_contact_percentage": 0.0, "confidence_percentage": 0.0, "attention_score": 0.0}],
        technical_answers=[{"technical_score": 0.0, "problem_solving": 0.0, "completeness": 0.0}],
        transcripts=[""],
        session_info={"duration_minutes": 10}
    )
    assert scores_f["overall_score"] >= 0.0
    assert scores_f["recommendation"] in ("Reject", "Hold")

    # Case G: Maximum scores (100.0)
    scores_g = await engine.calculate_session_scores(
        speech_results=[{"speaking_pace_wpm": 140.0, "filler_word_count": 0, "grammar_score": 100.0, "clarity_score": 100.0, "vocabulary_richness": 100.0}],
        vision_results=[{"eye_contact_percentage": 100.0, "confidence_percentage": 100.0, "attention_score": 100.0}],
        technical_answers=[{"technical_score": 100.0, "problem_solving": 100.0, "completeness": 100.0, "domain_knowledge": 100.0}],
        transcripts=["Perfect architectural design with complete fault tolerance and optimal scalability."],
        session_info={"duration_minutes": 15}
    )
    assert scores_g["overall_score"] >= 90.0
    assert scores_g["recommendation"] == "Shortlist"

    # Case H: Partial evaluation data
    scores_h = await engine.calculate_session_scores(
        speech_results=[{"clarity_score": 75.0}],
        vision_results=[],
        technical_answers=[{"technical_score": 70.0}],
        transcripts=["Short statement"],
        session_info={}
    )
    assert scores_h["overall_score"] >= 0.0

    # Deterministic test: same input must yield identical score
    scores_h2 = await engine.calculate_session_scores(
        speech_results=[{"clarity_score": 75.0}],
        vision_results=[],
        technical_answers=[{"technical_score": 70.0}],
        transcripts=["Short statement"],
        session_info={}
    )
    assert scores_h["overall_score"] == scores_h2["overall_score"]


def test_resume_parser_all_conditions():
    """
    Verify:
    - valid resume text
    - empty text
    - malformed text
    - technical skills
    - education
    - missing sections
    """
    # 1. Valid resume text with skills and education
    valid_text = (
        "John Doe\n"
        "Email: john@example.com\n"
        "Education: Bachelor of Technology (B.Tech) in Computer Science\n"
        "Skills: React, TypeScript, Python, FastAPI, Docker, PostgreSQL, AWS, Git\n"
        "Experience: 5 years designing scalable microservices and full-stack web applications."
    )
    res_valid = resume_service.parse_resume_text(valid_text)
    assert "Python" in res_valid["skills"]
    assert "React" in res_valid["skills"]
    assert "FastAPI" in res_valid["skills"]
    assert res_valid["ats_score"] >= 80.0
    assert res_valid["has_skills"] is True
    assert res_valid["has_education"] is True
    assert len(res_valid["education"]) > 0

    # 2. Empty text
    res_empty = resume_service.parse_resume_text("")
    assert res_empty["skills"] == []
    assert res_empty["ats_score"] == 60.0
    assert res_empty["word_count"] == 0
    assert res_empty["has_skills"] is False
    assert res_empty["has_education"] is False

    # 3. None text
    res_none = resume_service.parse_resume_text(None)
    assert res_none["skills"] == []
    assert res_none["ats_score"] == 60.0

    # 4. Malformed text with weird characters
    malformed = "%%%$$$@@@ ^^^ &&& *** random words without punctuation 123456789"
    res_malformed = resume_service.parse_resume_text(malformed)
    assert isinstance(res_malformed["ats_score"], float)
    assert res_malformed["has_skills"] is False

    # 5. Missing sections (skills only, no education)
    skills_only = "Expert in Python, Docker, Kubernetes, Linux, CI/CD, and PostgreSQL database tuning."
    res_skills_only = resume_service.parse_resume_text(skills_only)
    assert res_skills_only["has_skills"] is True
    assert res_skills_only["has_education"] is False
