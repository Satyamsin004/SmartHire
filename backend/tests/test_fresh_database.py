import os
import pytest
from sqlalchemy import create_engine, inspect, select
from app.core.db import Base
import app.models.domain  # loads all domain models
from app.models.domain import User, Candidate, InterviewSession, InterviewQuestion, MasterQuestionBank, AssessmentQuestion

def test_fresh_database_initialization():
    """
    Mandatory Fresh Database Verification:
    Tests whether a NEW/FRESH database can be initialized from scratch
    via ORM models without relying on pre-existing database files.
    """
    test_db_path = "test_fresh_audit.sqlite"
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

    try:
        engine = create_engine(f"sqlite:///{test_db_path}")
        # 1. Initialize schema from scratch
        Base.metadata.create_all(engine)

        # 2. Inspect tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert "users" in tables
        assert "candidates" in tables
        assert "interview_sessions" in tables
        assert "interview_questions" in tables
        assert "scoring_reports" in tables
        assert "assessment_questions" in tables
        assert "master_question_bank" in tables

        # 3. Inspect columns in assessment_questions
        aq_cols = [c["name"] for c in inspector.get_columns("assessment_questions")]
        assert "passage_text" in aq_cols, "passage_text missing in fresh assessment_questions"
        assert "dataset_json" in aq_cols, "dataset_json missing in fresh assessment_questions"
        assert "test_cases" in aq_cols, "test_cases missing in fresh assessment_questions"

        # 4. Inspect columns in master_question_bank
        mqb_cols = [c["name"] for c in inspector.get_columns("master_question_bank")]
        assert "passage_text" in mqb_cols, "passage_text missing in fresh master_question_bank"
        assert "dataset_json" in mqb_cols, "dataset_json missing in fresh master_question_bank"
        assert "test_cases" in mqb_cols, "test_cases missing in fresh master_question_bank"

        # 5. Insert records to verify ORM operation
        with engine.connect() as conn:
            with conn.begin():
                user_id = "test-fresh-user-001"
                conn.execute(
                    User.__table__.insert().values(
                        id=user_id,
                        email="fresh@test.com",
                        full_name="Fresh User",
                        role="candidate",
                        password_hash="hashed_pw"
                    )
                )
                conn.execute(
                    Candidate.__table__.insert().values(
                        id="test-fresh-cand-001",
                        user_id=user_id,
                        target_role="Full Stack"
                    )
                )
                conn.execute(
                    AssessmentQuestion.__table__.insert().values(
                        id="test-aq-001",
                        session_id="sess-001",
                        order_index=1,
                        question_text="Sample fresh question?",
                        options=["A", "B"],
                        correct_option=0,
                        passage_text="Sample passage text",
                        dataset_json={"data": [1, 2, 3]},
                        test_cases=[{"input": "1", "output": "1"}]
                    )
                )
            
            # Query back
            row = conn.execute(select(AssessmentQuestion.__table__).where(AssessmentQuestion.__table__.c.id == "test-aq-001")).mappings().first()
            assert row is not None
            assert row["passage_text"] == "Sample passage text"
            assert row["dataset_json"] == {"data": [1, 2, 3]}

        engine.dispose()
    finally:
        if os.path.exists(test_db_path):
            try:
                os.remove(test_db_path)
            except Exception:
                pass
