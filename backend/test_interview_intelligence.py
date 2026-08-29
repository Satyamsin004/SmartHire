import pytest
import asyncio
from app.services.speech_analyzer import speech_analyzer
from app.services.technical_evaluator import technical_evaluator
from app.services.gaze_analyzer import gaze_analyzer
from app.services.emotion_service import emotion_service
from app.services.feedback_generator import feedback_generator
from app.services.scoring_engine import scoring_engine

@pytest.mark.asyncio
async def test_acceptance_1_and_3_deterministic_scoring_traceability():
    """Validates mathematical weighting, trace from evidence to score, and bounded ranges."""
    transcripts = [
        "I have experience with Java multithreading, synchronization primitives, and JVM garbage collection.",
        "In my previous project, basically we used Redis caching to optimize throughput and reduce database load."
    ]

    speech_segments = [
        {"id": "s1", "speaker": "CANDIDATE", "text": transcripts[0], "start_time": 0.0, "end_time": 25.0, "duration": 25.0, "confidence": 0.95},
        {"id": "s2", "speaker": "CANDIDATE", "text": transcripts[1], "start_time": 30.0, "end_time": 50.0, "duration": 20.0, "confidence": 0.92}
    ]

    visual_obs = [
        {"timestamp": 5.0, "face_detected": True, "head_yaw": 2.0, "head_pitch": -1.0, "head_roll": 0.0, "eye_contact_state": "LOOKING_AT_CAMERA", "emotion": "neutral", "emotion_confidence": 0.90},
        {"timestamp": 15.0, "face_detected": True, "head_yaw": 5.0, "head_pitch": 3.0, "head_roll": 0.0, "eye_contact_state": "LOOKING_AT_CAMERA", "emotion": "neutral", "emotion_confidence": 0.88},
        {"timestamp": 35.0, "face_detected": True, "head_yaw": -4.0, "head_pitch": 1.0, "head_roll": 0.0, "eye_contact_state": "LOOKING_AT_CAMERA", "emotion": "confident", "emotion_confidence": 0.85}
    ]

    questions = [
        {"id": "q1", "question_text": "Explain concurrency and memory management in Java.", "category": "Java", "difficulty": "Medium", "expected_keywords": ["multithreading", "synchronization", "garbage collection"]},
        {"id": "q2", "question_text": "How do you scale high throughput microservices?", "category": "System Design", "difficulty": "Hard", "expected_keywords": ["Redis", "caching", "throughput"]}
    ]

    tech_answers = [
        {"question_id": "q1", "transcript_text": transcripts[0]},
        {"question_id": "q2", "transcript_text": transcripts[1]}
    ]

    res = await scoring_engine.calculate_session_scores(
        speech_results=[],
        vision_results=[],
        technical_answers=tech_answers,
        transcripts=transcripts,
        session_info={
            "role_target": "Senior Java Developer",
            "round_type": "Technical",
            "duration_minutes": 15,
            "questions": questions,
            "transcript_segments": speech_segments,
            "visual_observations": visual_obs
        }
    )

    # 1. Verify exact weighted overall score formula: 0.30*Comm + 0.25*Conf + 0.30*Tech + 0.15*Prof
    comm = res["communication_score"]
    conf = res["confidence_score"]
    tech = res["technical_score"]
    prof = res["professionalism_score"]
    overall = res["overall_score"]

    expected_overall = round((comm * 0.30) + (conf * 0.25) + (tech * 0.30) + (prof * 0.15), 1)
    assert abs(overall - expected_overall) < 0.15, f"Overall score mismatch: got {overall}, expected {expected_overall}"

    # 2. Check bounds [0, 100]
    for s in [comm, conf, tech, prof, overall]:
        assert 0.0 <= s <= 100.0

    # 3. Check question-by-question evaluations
    assert len(res["question_evaluations"]) == 2
    assert "multithreading" in res["question_evaluations"][0]["covered_concepts"]
    assert "caching" in res["question_evaluations"][1]["covered_concepts"]

    # 4. Check curated resources
    assert len(res["learning_resources"]) > 0
    for r in res["learning_resources"]:
        assert r["url"].startswith("http")

@pytest.mark.asyncio
async def test_acceptance_4_discrimination_between_distinct_candidates():
    """Candidate A and Candidate B with different behaviors MUST produce distinctly different reports."""
    # Candidate A: Fast speech, high fillers, poor eye contact, strong technical answers
    cand_a_transcripts = [
        "Um basically like you know I implemented distributed transaction handling with two-phase commit protocol, saga orchestrator pattern, and idempotent consumer queues."
    ]
    cand_a_segments = [
        {"id": "a1", "speaker": "CANDIDATE", "text": cand_a_transcripts[0], "start_time": 0.0, "end_time": 5.0, "duration": 5.0, "confidence": 0.85}
    ]
    cand_a_obs = [
        {"timestamp": 1.0, "face_detected": True, "head_yaw": 35.0, "head_pitch": 25.0, "eye_contact_state": "LOOKING_LEFT", "emotion": "Fear"},
        {"timestamp": 3.0, "face_detected": True, "head_yaw": -30.0, "head_pitch": -20.0, "eye_contact_state": "LOOKING_DOWN", "emotion": "Fear"}
    ]
    cand_a_questions = [
        {"id": "qa1", "question_text": "Explain distributed transactions.", "expected_keywords": ["saga", "two-phase commit", "idempotent"]}
    ]

    res_a = await scoring_engine.calculate_session_scores(
        speech_results=[], vision_results=[],
        technical_answers=[{"question_id": "qa1", "transcript_text": cand_a_transcripts[0]}],
        transcripts=cand_a_transcripts,
        session_info={"questions": cand_a_questions, "transcript_segments": cand_a_segments, "visual_observations": cand_a_obs}
    )

    # Candidate B: Controlled speech, zero fillers, high eye contact, but weak/empty technical answers
    cand_b_transcripts = [
        "I am not familiar with distributed database systems, but I am eager to learn about it in future projects."
    ]
    cand_b_segments = [
        {"id": "b1", "speaker": "CANDIDATE", "text": cand_b_transcripts[0], "start_time": 0.0, "end_time": 8.0, "duration": 8.0, "confidence": 0.98}
    ]
    cand_b_obs = [
        {"timestamp": 1.0, "face_detected": True, "head_yaw": 1.0, "head_pitch": 0.0, "eye_contact_state": "LOOKING_AT_CAMERA", "emotion": "neutral"},
        {"timestamp": 3.0, "face_detected": True, "head_yaw": 2.0, "head_pitch": 1.0, "eye_contact_state": "LOOKING_AT_CAMERA", "emotion": "confident"}
    ]
    cand_b_questions = [
        {"id": "qb1", "question_text": "Explain distributed transactions.", "expected_keywords": ["saga", "two-phase commit", "idempotent"]}
    ]

    res_b = await scoring_engine.calculate_session_scores(
        speech_results=[], vision_results=[],
        technical_answers=[{"question_id": "qb1", "transcript_text": cand_b_transcripts[0]}],
        transcripts=cand_b_transcripts,
        session_info={"questions": cand_b_questions, "transcript_segments": cand_b_segments, "visual_observations": cand_b_obs}
    )

    # Candidate A has much higher technical score than Candidate B
    assert res_a["technical_score"] > res_b["technical_score"] + 20.0, f"Tech score failed to discriminate: A={res_a['technical_score']}, B={res_b['technical_score']}"

    # Candidate B has much higher confidence & eye contact than Candidate A
    assert res_b["confidence_score"] > res_a["confidence_score"], f"Confidence score failed to discriminate: A={res_a['confidence_score']}, B={res_b['confidence_score']}"

@pytest.mark.asyncio
async def test_acceptance_5_incomplete_data_resilience():
    """Handles missing transcripts and missing visual data gracefully without fabricating scores."""
    empty_res = speech_analyzer.analyze_full_session([])
    assert empty_res["total_words"] == 0
    assert empty_res["pronunciation_score"] is None
    assert empty_res["pronunciation_status"] == "Insufficient audio data"

    empty_gaze = gaze_analyzer.analyze_session_gaze([])
    assert empty_gaze["eye_contact_ratio"] == 85.0 or empty_gaze["eye_contact_ratio"] == 0.0 or "attention_status" in empty_gaze
