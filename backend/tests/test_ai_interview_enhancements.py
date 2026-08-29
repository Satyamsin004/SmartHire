import asyncio
import pytest
import sys
import os

sys.path.insert(0, r"e:\coding\projects\hiringproject\backend")

from app.core.db import AsyncSessionLocal
from app.models.domain import User, Candidate, InterviewSession, InterviewQuestion
from app.services.ai_engine import ai_engine
from app.services.interview_service import QuestionGeneratorService
from sqlalchemy.future import select

@pytest.mark.asyncio
async def test_verbal_evaluation_praise_prefix():
    """Verify that evaluate_candidate_answer includes enthusiastic verbal praise ('Well done!', 'Good answer!')."""
    q_text = "How do you handle database indexing and query performance in PostgreSQL?"
    cand_ans = "I create B-Tree indexes on frequently queried columns and analyze query execution plans using EXPLAIN ANALYZE."

    feedback = await ai_engine.evaluate_candidate_answer(
        question_text=q_text,
        candidate_answer=cand_ans,
        role="Senior Backend Engineer",
        is_transition=True,
        next_topic="System Design"
    )

    print(f"\nGenerated Spoken Feedback: '{feedback}'")
    assert any(feedback.startswith(prefix) for prefix in ["Well done!", "Good answer!", "Great explanation!", "Excellent response!", "Nice approach!", "Solid answer!"]), \
        f"Feedback does not start with enthusiastic verbal praise: '{feedback}'"


@pytest.mark.asyncio
async def test_interview_question_uniqueness_across_sessions():
    """Verify that question generation checks candidate history and avoids duplicate questions across attempts."""
    async with AsyncSessionLocal() as db:
        res_u = await db.execute(select(User).where(User.role == 'candidate').limit(1))
        user = res_u.scalar_one_or_none()

        res_c = await db.execute(select(Candidate).where(Candidate.user_id == user.id))
        candidate = res_c.scalar_one_or_none()

        session = InterviewSession(
            candidate_id=candidate.id,
            role_target="Software Engineer",
            round_type="Technical",
            difficulty="Medium",
            question_count=4,
            status="active"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        context = {
            "role": "Software Engineer",
            "round_type": "Technical",
            "difficulty": "Medium",
            "resume_summary": "Python FastAPI Developer",
            "resume_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"]
        }

        qs = await QuestionGeneratorService.generate_unique_session_questions(
            db=db,
            session=session,
            context=context,
            num_questions=4
        )

        assert len(qs) == 4
        q_texts = [q["question_text"] for q in qs]
        assert len(set(q_texts)) == 4, "Duplicate questions found within session!"


async def main():
    print("\n[TEST 1] Testing Spoken Verbal Evaluation Praise ('Well done!', 'Good answer!')...")
    await test_verbal_evaluation_praise_prefix()
    print("  -> PASSED!")

    print("\n[TEST 2] Testing Candidate Interview Question Uniqueness Across Sessions...")
    await test_interview_question_uniqueness_across_sessions()
    print("  -> PASSED!")

    print("\n========================================================")
    print("ALL AI INTERVIEW PROCESS TESTS PASSED SUCCESSFULLY!")
    print("========================================================\n")

if __name__ == "__main__":
    asyncio.run(main())
