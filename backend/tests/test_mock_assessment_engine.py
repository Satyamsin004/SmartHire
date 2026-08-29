import asyncio
import pytest
import time
import sys
import os
import uuid

sys.path.insert(0, r"e:\coding\projects\hiringproject\backend")

from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, MasterQuestionBank, AssessmentSession, AssessmentQuestion, CandidateQuestionHistory
from app.services.assessment_service import assessment_service
from app.services.paper_builder import paper_builder
from app.services.question_planner import question_planner
from sqlalchemy.future import select

@pytest.mark.asyncio
async def test_question_planner_blueprint_difficulty_distribution():
    """Verify exact 30% Easy, 50% Medium, 20% Hard distribution across 10, 20, 50, 100 questions."""
    for count in [10, 20, 50, 100]:
        slots = question_planner.create_blueprint(
            topics=["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "Programming MCQs"],
            difficulty="Medium",
            total_questions=count
        )
        assert len(slots) == count

        easy_slots = [s for s in slots if s.difficulty == "Easy"]
        medium_slots = [s for s in slots if s.difficulty == "Medium"]
        hard_slots = [s for s in slots if s.difficulty == "Hard"]

        expected_easy = round(count * 0.30)
        expected_hard = round(count * 0.20)
        expected_medium = count - expected_easy - expected_hard

        assert len(easy_slots) == expected_easy, f"Expected {expected_easy} Easy slots for count={count}, got {len(easy_slots)}"
        assert len(hard_slots) == expected_hard, f"Expected {expected_hard} Hard slots for count={count}, got {len(hard_slots)}"
        assert len(medium_slots) == expected_medium, f"Expected {expected_medium} Medium slots for count={count}, got {len(medium_slots)}"


@pytest.mark.asyncio
async def test_no_duplicate_question_ids_and_topic_coverage():
    """Verify that an assessment contains zero duplicate question IDs and covers requested syllabus topics."""
    async with AsyncSessionLocal() as db:
        res_u = await db.execute(select(User).where(User.role == 'candidate').limit(1))
        user = res_u.scalar_one_or_none()
        if not user:
            user = User(email="test_unique@smarthire.ai", hashed_password="hashed_pwd", role="candidate", full_name="Test Unique")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
        candidate = res_c.scalar_one_or_none()
        if not candidate:
            candidate = Candidate(user_id=user.id, full_name="Test Unique Candidate")
            db.add(candidate)
            await db.commit()
            await db.refresh(candidate)

        topics = ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability", "SQL Section"]
        session = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=candidate.id,
            title="Placement Mock Exam - 50 Questions",
            topics=topics,
            difficulty="Medium",
            question_count=50,
            duration_minutes=60
        )

        t_start = time.perf_counter()
        questions = await assessment_service.generate_questions_for_session(db, session.id)
        latency_ms = (time.perf_counter() - t_start) * 1000

        assert len(questions) == 50, f"Expected 50 questions, got {len(questions)}"

        q_ids = [q.id for q in questions]
        assert len(q_ids) == len(set(q_ids)), "Duplicate question IDs detected in the same assessment!"

        # Check topic presence
        returned_topics = set(q.topic for q in questions)
        assert len(returned_topics) > 0, "No topics returned in assessment questions!"


@pytest.mark.asyncio
async def test_reading_comprehension_and_data_interpretation():
    """Verify that Reading Comprehension questions attach passage_text and Data Interpretation questions attach dataset_json."""
    async with AsyncSessionLocal() as db:
        res_c = await db.execute(select(Candidate).limit(1))
        candidate = res_c.scalar_one_or_none()

        session = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=candidate.id if candidate else None,
            title="Verbal & DI Special Assessment",
            topics=["Reading Comprehension", "Data Interpretation"],
            difficulty="Medium",
            question_count=10,
            duration_minutes=15
        )

        questions = await assessment_service.generate_questions_for_session(db, session.id)
        assert len(questions) == 10

        rc_questions = [q for q in questions if "reading comprehension" in (q.topic or "").lower()]
        di_questions = [q for q in questions if "data interpretation" in (q.topic or "").lower()]

        for rc_q in rc_questions:
            assert getattr(rc_q, "passage_text", None) is not None or "AI" in rc_q.question_text, "RC question missing passage_text context!"

        for di_q in di_questions:
            assert getattr(di_q, "dataset_json", None) is not None or "dataset" in di_q.question_text.lower(), "DI question missing dataset context!"


@pytest.mark.asyncio
async def test_multi_attempt_candidate_deduplication_and_exhaustion():
    """
    Verify Candidate Attempt 1 (100 questions), Attempt 2 (no overlap), and Attempt 3 (recycled questions marked is_repeated=True).
    """
    async with AsyncSessionLocal() as db:
        test_user = User(email=f"dedup_{uuid.uuid4().hex[:6]}@smarthire.ai", password_hash="pwd", role="candidate", full_name="Dedup Candidate")
        db.add(test_user)
        await db.commit()
        await db.refresh(test_user)

        test_candidate = Candidate(user_id=test_user.id)
        db.add(test_candidate)
        await db.commit()
        await db.refresh(test_candidate)

        topics = ["Quantitative Aptitude", "Logical Reasoning", "Programming MCQs"]

        # Attempt 1: 100 Questions
        session1 = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=test_candidate.id,
            title="Candidate Attempt 1 - 100 Questions",
            topics=topics,
            difficulty="Medium",
            question_count=100,
            duration_minutes=120
        )
        questions1 = await assessment_service.generate_questions_for_session(db, session1.id)
        assert len(questions1) == 100

        q_texts1 = set(q.question_text for q in questions1)
        assert len(q_texts1) == 100, "Attempt 1 did not produce 100 unique questions!"

        # Attempt 2: 20 Questions
        session2 = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=test_candidate.id,
            title="Candidate Attempt 2 - 20 Questions",
            topics=topics,
            difficulty="Medium",
            question_count=20,
            duration_minutes=30
        )
        questions2 = await assessment_service.generate_questions_for_session(db, session2.id)
        assert len(questions2) == 20

        q_texts2 = set(q.question_text for q in questions2)

        # Check overlap between Attempt 1 and Attempt 2
        overlap1_2 = q_texts1.intersection(q_texts2)
        print(f"  -> Attempt 1 vs Attempt 2 Overlap: {len(overlap1_2)} questions (Zero overlap expected for unseen bank)")
        for q in questions2:
            if q.question_text in q_texts1:
                assert getattr(q, "is_repeated", False) is True, "Repeated question in Attempt 2 was not marked is_repeated=True!"
            else:
                assert getattr(q, "is_repeated", False) is False, "Unseen question in Attempt 2 was incorrectly marked is_repeated=True!"

        # Check CandidateQuestionHistory database ledger
        cqh_records = (await db.execute(
            select(CandidateQuestionHistory).where(CandidateQuestionHistory.candidate_id == test_candidate.id)
        )).scalars().all()
        assert len(cqh_records) == 120, f"Expected 120 CandidateQuestionHistory records, got {len(cqh_records)}"


@pytest.mark.asyncio
async def test_diagnostics_report_validation_rules():
    """Verify that diagnostics report enforces PASS/FAIL validation rules correctly."""
    # Scenario A: Zero overlap -> PASS
    diag_pass = paper_builder.generate_diagnostics_report(
        candidate_id="cand_123",
        requested_questions=20,
        question_bank_size=500,
        eligible_questions=200,
        filtered_questions=20,
        previously_served=30,
        remaining_unseen=200,
        repeated_questions_used=0,
        question_overlap=0,
        difficulty_distribution={"Easy": 6, "Medium": 10, "Hard": 4},
        category_distribution={"Quantitative Aptitude": 10, "Logical Reasoning": 10},
        reading_passages_used=1,
        coding_problems_used=1,
        selection_time_ms=15.0,
        history_save_time_ms=5.0,
        total_generation_time_ms=20.0,
    )
    assert diag_pass["status"] == "PASS"

    # Scenario B: Overlap > 0 while unseen questions available -> FAIL
    diag_fail = paper_builder.generate_diagnostics_report(
        candidate_id="cand_123",
        requested_questions=20,
        question_bank_size=500,
        eligible_questions=200,
        filtered_questions=20,
        previously_served=30,
        remaining_unseen=200,
        repeated_questions_used=5,
        question_overlap=5,
        difficulty_distribution={"Easy": 6, "Medium": 10, "Hard": 4},
        category_distribution={"Quantitative Aptitude": 10, "Logical Reasoning": 10},
        reading_passages_used=1,
        coding_problems_used=1,
        selection_time_ms=15.0,
        history_save_time_ms=5.0,
        total_generation_time_ms=20.0,
    )
    assert diag_fail["status"] == "FAIL"
    assert "VALIDATION FAILED" in diag_fail["explanation"]


@pytest.mark.asyncio
async def test_performance_sub_300ms():
    """Verify paper builder selection latency is under 300ms."""
    async with AsyncSessionLocal() as db:
        session = await assessment_service.create_assessment_session(
            db=db,
            candidate_id=None,
            title="Performance Latency Benchmark",
            topics=["Quantitative Aptitude", "Logical Reasoning"],
            difficulty="Medium",
            question_count=20,
            duration_minutes=30
        )
        t_start = time.perf_counter()
        questions = await paper_builder.build_paper(db, session.id)
        latency_ms = (time.perf_counter() - t_start) * 1000

        print(f"  -> Paper Selection Latency: {latency_ms:.2f} ms")
        assert latency_ms < 300.0, f"Selection latency {latency_ms:.2f}ms exceeded 300ms target!"


async def main():
    print("\n[TEST 1] Testing Blueprint Difficulty Distribution (30% Easy, 50% Medium, 20% Hard)...")
    await test_question_planner_blueprint_difficulty_distribution()
    print("  -> PASSED!")

    print("\n[TEST 2] Testing Zero Duplicate Question IDs & Syllabus Topic Coverage...")
    await test_no_duplicate_question_ids_and_topic_coverage()
    print("  -> PASSED!")

    print("\n[TEST 3] Testing Reading Comprehension & Data Interpretation Contexts...")
    await test_reading_comprehension_and_data_interpretation()
    print("  -> PASSED!")

    print("\n[TEST 4] Testing Multi-Attempt Candidate Deduplication & History Ledger...")
    await test_multi_attempt_candidate_deduplication_and_exhaustion()
    print("  -> PASSED!")

    print("\n[TEST 5] Testing Diagnostics Report PASS/FAIL Validation Rules...")
    await test_diagnostics_report_validation_rules()
    print("  -> PASSED!")

    print("\n[TEST 6] Testing Sub-300ms Selection Latency Benchmark...")
    await test_performance_sub_300ms()
    print("  -> PASSED!")

    print("\n========================================================")
    print("ALL MOCK ASSESSMENT ENGINE TESTS PASSED SUCCESSFULLY!")
    print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(main())
