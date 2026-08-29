import os
import pytest
import base64
import io
import uuid
import numpy as np
from PIL import Image
from sqlalchemy.future import select

from app.core.db import AsyncSessionLocal
from app.models.domain import (
    User, Candidate, InterviewSession, InterviewQuestion, InterviewAnswer,
    InterviewTranscriptSegment, InterviewVisualObservation, InterviewVisualMetric,
    InterviewSpeechMetric, ScoringReport
)
from ml.emotion.validate_dataset import find_dataset_root
from ml.emotion.inference import emotion_inference_engine
from app.services.interview_service import EvaluationService

@pytest.mark.asyncio
async def test_end_to_end_interview_with_trained_emotion_model():
    """
    Simulates a full real interview session:
    1. Creates session & candidate.
    2. Streams real camera frames through the trained FER2013 model.
    3. Persists InterviewVisualObservation entities.
    4. Evaluates interview & aggregates emotion metrics into ScoringReport & InterviewVisualMetric.
    5. Asserts evidence-based distribution, timelines, and deterministic scores.
    """
    root = find_dataset_root()
    confident_img_path = os.path.join(root, "test", "confident", [f for f in os.listdir(os.path.join(root, "test", "confident")) if f.endswith(".jpg")][0])
    neutral_img_path = os.path.join(root, "test", "neutral", [f for f in os.listdir(os.path.join(root, "test", "neutral")) if f.endswith(".jpg")][0])

    async with AsyncSessionLocal() as db:
        # Create candidate & session
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email=f"candidate_{user_id[:8]}@example.com",
            full_name="Jane Doe",
            role="candidate",
            password_hash="test_password_hash_2026"
        )
        db.add(user)
        
        cand_id = str(uuid.uuid4())
        candidate = Candidate(id=cand_id, user_id=user_id, target_role="Senior Full Stack Engineer")
        db.add(candidate)

        session_id = str(uuid.uuid4())
        session = InterviewSession(
            id=session_id,
            candidate_id=cand_id,
            role_target="Senior Full Stack Engineer",
            round_type="Technical & System Design",
            difficulty="Medium",
            status="IN_PROGRESS",
            duration_minutes=15
        )
        db.add(session)

        # Add 2 questions & answers
        q1 = InterviewQuestion(
            id=str(uuid.uuid4()),
            session_id=session_id,
            question_text="Explain the differences between SQL and NoSQL databases.",
            order_index=1,
            category="Technical",
            difficulty="Medium"
        )
        q2 = InterviewQuestion(
            id=str(uuid.uuid4()),
            session_id=session_id,
            question_text="How do you handle distributed state management in Microservices?",
            order_index=2,
            category="System Design",
            difficulty="Medium"
        )
        db.add_all([q1, q2])

        a1 = InterviewAnswer(
            id=str(uuid.uuid4()),
            question_id=q1.id,
            transcript_text="SQL databases are relational and ACID compliant with structured schemas, while NoSQL databases like MongoDB or Cassandra are horizontally scalable and schema-flexible."
        )
        a2 = InterviewAnswer(
            id=str(uuid.uuid4()),
            question_id=q2.id,
            transcript_text="We use event-driven architecture with Apache Kafka and the Saga pattern for eventual consistency across microservice boundaries."
        )
        db.add_all([a1, a2])

        # Add real transcript segments
        t1 = InterviewTranscriptSegment(
            id=str(uuid.uuid4()),
            session_id=session_id,
            candidate_id=cand_id,
            speaker="candidate",
            text="SQL databases provide ACID transactions while NoSQL allows flexible document structures.",
            start_time=5.0,
            end_time=30.0,
            sequence_number=1
        )
        t2 = InterviewTranscriptSegment(
            id=str(uuid.uuid4()),
            session_id=session_id,
            candidate_id=cand_id,
            speaker="candidate",
            text="Basically we use Kafka and the Saga pattern for state consistency across services.",
            start_time=35.0,
            end_time=70.0,
            sequence_number=2
        )
        db.add_all([t1, t2])

        # Feed real camera frames through the trained emotion model
        # Frame 1: Neutral
        with Image.open(neutral_img_path) as img:
            pred1 = emotion_inference_engine.predict_face_image(img)
            obs1 = InterviewVisualObservation(
                session_id=session_id,
                candidate_id=cand_id,
                timestamp=10.0,
                face_detected=True,
                face_confidence=0.95,
                eye_contact_state="LOOKING_AT_CAMERA",
                emotion=pred1["dominant_emotion"],
                emotion_confidence=pred1["confidence"],
                attention_state="FOCUSED"
            )
            db.add(obs1)

        # Frame 2: Confident
        with Image.open(confident_img_path) as img:
            pred2 = emotion_inference_engine.predict_face_image(img)
            obs2 = InterviewVisualObservation(
                session_id=session_id,
                candidate_id=cand_id,
                timestamp=35.0,
                face_detected=True,
                face_confidence=0.98,
                eye_contact_state="LOOKING_AT_CAMERA",
                emotion=pred2["dominant_emotion"],
                emotion_confidence=pred2["confidence"],
                attention_state="FOCUSED"
            )
            db.add(obs2)

        # Frame 3: Neutral
        with Image.open(neutral_img_path) as img:
            pred3 = emotion_inference_engine.predict_face_image(img)
            obs3 = InterviewVisualObservation(
                session_id=session_id,
                candidate_id=cand_id,
                timestamp=60.0,
                face_detected=True,
                face_confidence=0.94,
                eye_contact_state="LOOKING_AT_CAMERA",
                emotion=pred3["dominant_emotion"],
                emotion_confidence=pred3["confidence"],
                attention_state="FOCUSED"
            )
            db.add(obs3)

        await db.commit()

        # Execute Interview Completion & Evaluation
        report = await EvaluationService.generate_and_finalize_report(db=db, session_id=session_id)

        # Verify evaluation results
        assert report is not None
        assert report.status == "COMPLETED"
        assert report.overall_score >= 0.0 and report.overall_score <= 100.0
        
        # Verify Visual Metric entity
        res_vism = await db.execute(select(InterviewVisualMetric).where(InterviewVisualMetric.session_id == session_id))
        vis_metric = res_vism.scalar_one_or_none()
        assert vis_metric is not None
        assert vis_metric.dominant_emotion in ["neutral", "confident", "confused", "fear", "focused", "frustrated", "Looking away", "unconfident", "Neutral", "Confident", "UNCERTAIN"]
        assert len(vis_metric.emotion_distribution) > 0
        assert len(vis_metric.emotion_timeline) > 0

        # Verify deterministic scoring formula
        expected_score = round(
            (0.30 * report.communication_score) +
            (0.25 * report.confidence_score) +
            (0.30 * report.technical_score) +
            (0.15 * report.professionalism_score),
            1
        )
        assert abs(report.overall_score - expected_score) <= 0.2

        print("\n[SUCCESS] Completed Real Interview Workflow Test with Trained Emotion Model:")
        print(f"  Session ID:         {session_id}")
        print(f"  Overall Score:      {report.overall_score}%")
        print(f"  Dominant Emotion:   {vis_metric.dominant_emotion}")
        print(f"  Emotion Dist:       {vis_metric.emotion_distribution}")
        print(f"  Timeline Segments:  {len(vis_metric.emotion_timeline)}")
