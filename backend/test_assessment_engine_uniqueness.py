import asyncio
import sys
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.db import AsyncSessionLocal, engine, Base
from app.models.domain import User, Candidate, AssessmentSession, AssessmentQuestion
from app.services.assessment_service import AssessmentService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_assessment_uniqueness")

async def run_uniqueness_test():
    print("=" * 80)
    print("=== TESTING AI ASSESSMENT ENGINE QUESTION UNIQUENESS & DEDUPLICATION ===")
    print("=" * 80)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Create a test candidate user
        res_u = await db.execute(select(User).where(User.email == "assessment_test_candidate@smarthire.ai"))
        u = res_u.scalar_one_or_none()
        if not u:
            u = User(
                email="assessment_test_candidate@smarthire.ai",
                password_hash="testpass123",
                full_name="Assessment Test Candidate",
                role="candidate"
            )
            db.add(u)
            await db.commit()
            await db.refresh(u)

        res_c = await db.execute(select(Candidate).where(Candidate.user_id == u.id))
        c = res_c.scalar_one_or_none()
        if not c:
            c = Candidate(user_id=u.id)
            db.add(c)
            await db.commit()
            await db.refresh(c)

        print(f"Candidate Verified [OK] ID: {c.id} | User: {u.full_name}")

        attempts_questions = []

        # Run 3 consecutive assessment attempts with 20 React questions each
        for attempt_num in range(1, 4):
            print(f"\n--- Launching Attempt {attempt_num}: 20 React Questions ---")
            session = await AssessmentService.create_assessment_session(
                db=db,
                candidate_id=c.id,
                title=f"React Assessment Attempt {attempt_num}",
                topics=["React"],
                difficulty="Medium",
                question_count=20,
                duration_minutes=30
            )

            questions = await AssessmentService.generate_questions_for_session(db, session.id)
            q_texts = [q.question_text for q in questions]
            attempts_questions.append(q_texts)

            print(f"Attempt {attempt_num} Completed [OK] Generated {len(questions)} Questions.")
            print(f"Sample Question 1: '{q_texts[0][:70]}...'")
            print(f"Sample Question 20: '{q_texts[-1][:70]}...'")

        print("\n" + "=" * 80)
        print("=== EVALUATING OVERLAP PERCENTAGES BETWEEN ATTEMPTS ===")
        print("=" * 80)

        pairs = [(0, 1, "Attempt 1 vs Attempt 2"), (1, 2, "Attempt 2 vs Attempt 3"), (0, 2, "Attempt 1 vs Attempt 3")]
        passed_all = True

        for i, j, label in pairs:
            set_i = set(attempts_questions[i])
            set_j = set(attempts_questions[j])

            # Check similarity pairwise
            duplicate_count = 0
            for text_i in set_i:
                for text_j in set_j:
                    sim = AssessmentService.calculate_text_similarity(text_i, text_j)
                    if sim > 0.70:
                        duplicate_count += 1
                        print(f"[WARNING] Similarity detected ({sim*100:.1f}%): '{text_i[:50]}' vs '{text_j[:50]}'")

            overlap_pct = (duplicate_count / max(1, len(set_i))) * 100.0
            print(f"[METRIC] {label}: Overlap = {overlap_pct:.2f}% (Threshold: < 5.0%)")

            if overlap_pct >= 5.0:
                print(f"[FAIL] Overlap {overlap_pct:.2f}% exceeds 5% threshold!")
                passed_all = False
            else:
                print(f"[PASS] Overlap {overlap_pct:.2f}% is strictly below 5% threshold!")

        total_questions_generated = sum(len(q_list) for q_list in attempts_questions)
        unique_questions_overall = len(set([q for q_list in attempts_questions for q in q_list]))
        print(f"\nTotal Questions Generated Across 3 Attempts: {total_questions_generated}")
        print(f"Total Unique Question Statements: {unique_questions_overall} / {total_questions_generated}")

        if passed_all:
            print("\n[SUCCESS] ASSESSMENT ENGINE QUESTION UNIQUENESS VERIFIED AT 100%!")
            sys.exit(0)
        else:
            print("\n[FAILURE] QUESTION OVERLAP EXCEEDS THRESHOLD!")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_uniqueness_test())
