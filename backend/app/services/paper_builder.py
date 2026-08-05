import logging
import time
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    AssessmentQuestion, AssessmentQuestionHistory, AssessmentSession,
    MasterQuestionBank, RecruiterAssessmentHistory,
)
from app.services.ai_provider import ai_provider
from app.services.duplicate_detector import duplicate_detector
from app.services.question_factory import question_factory
from app.services.question_planner import BlueprintSlot, question_planner

logger = logging.getLogger("smarthire.paper_builder")


class PaperBuilder:
    """Enterprise Master Question Bank Paper Generation Engine."""

    @staticmethod
    def _is_topic_match(slot_topic: str, db_topic: str) -> bool:
        if not slot_topic or not db_topic:
            return False
        s_norm = slot_topic.strip().lower()
        d_norm = db_topic.strip().lower()
        if s_norm == d_norm or s_norm in d_norm or d_norm in s_norm:
            return True
        import re
        s_words = set(re.findall(r"\w+", s_norm))
        d_words = set(re.findall(r"\w+", d_norm))
        return bool(s_words and d_words and (s_words & d_words))

    @classmethod
    async def build_paper(
        cls, db: AsyncSession, session_id: str
    ) -> List[AssessmentQuestion]:
        """
        Builds a paper for candidate practice or recruiter assessment.
        Checks Master Question Bank first. If sufficient unseen questions exist,
        builds paper INSTANTLY from DB without any LLM call. Otherwise, triggers
        AI Question Factory for ONLY missing blueprint slots, stores in DB, and builds paper.
        """
        start_time = time.perf_counter()

        session = (await db.execute(
            select(AssessmentSession).where(AssessmentSession.id == session_id)
        )).scalar_one_or_none()
        if not session:
            raise ValueError("Assessment session not found.")

        # Check existing assessment questions
        existing_questions = (await db.execute(
            select(AssessmentQuestion)
            .where(AssessmentQuestion.session_id == session_id)
            .order_by(AssessmentQuestion.order_index)
        )).scalars().all()
        if len(existing_questions) >= session.question_count:
            return list(existing_questions)

        # Retrieve Candidate & Recruiter Exclusion History
        candidate_exclusions: Set[str] = set()
        if session.candidate_id:
            candidate_hist = (await db.execute(
                select(AssessmentQuestionHistory.question_fingerprint)
                .where(AssessmentQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all()
            candidate_exclusions.update(candidate_hist)

            # Include legacy persisted questions
            legacy_texts = (await db.execute(
                select(AssessmentQuestion.question_text)
                .join(AssessmentSession, AssessmentQuestion.session_id == AssessmentSession.id)
                .where(AssessmentSession.candidate_id == session.candidate_id)
            )).scalars().all()
            for text in legacy_texts:
                if text:
                    candidate_exclusions.add(duplicate_detector.compute_fingerprint(text))

        recruiter_exclusions: Set[str] = set()
        if session.recruiter_id:
            rec_hist = (await db.execute(
                select(RecruiterAssessmentHistory.question_fingerprint)
                .where(RecruiterAssessmentHistory.recruiter_id == session.recruiter_id)
            )).scalars().all()
            recruiter_exclusions.update(rec_hist)

        all_exclusions = candidate_exclusions | recruiter_exclusions

        # Step 1: Create Assessment Blueprint
        blueprint_slots = question_planner.create_blueprint(
            topics=list(session.topics),
            difficulty=session.difficulty,
            total_questions=session.question_count,
        )

        # Step 2: Query Master Question Bank for eligible unseen questions
        query = select(MasterQuestionBank)
        if all_exclusions:
            query = query.where(MasterQuestionBank.question_fingerprint.not_in(list(all_exclusions)))

        master_pool = list((await db.execute(query)).scalars().all())

        selected_master_items: List[MasterQuestionBank] = []
        missing_slots: List[BlueprintSlot] = []
        used_master_ids: Set[str] = set()

        # Step 2A: Smart Exact & Fuzzy Topic Matching
        for slot in blueprint_slots:
            eligible_candidates = [
                q for q in master_pool
                if q.id not in used_master_ids and cls._is_topic_match(slot.topic, q.topic)
            ]

            if eligible_candidates:
                diff_matched = [q for q in eligible_candidates if q.difficulty == slot.difficulty]
                chosen = diff_matched[0] if diff_matched else eligible_candidates[0]
                selected_master_items.append(chosen)
                used_master_ids.add(chosen.id)
            else:
                missing_slots.append(slot)

        # Step 2B: Instant Master Bank Fallback Selection BEFORE AI Generation
        if missing_slots and len(selected_master_items) < session.question_count:
            unseen_fallback_pool = [
                q for q in master_pool
                if q.id not in used_master_ids
            ]
            needed = session.question_count - len(selected_master_items)
            for fallback_q in unseen_fallback_pool[:needed]:
                selected_master_items.append(fallback_q)
                used_master_ids.add(fallback_q.id)

            # Re-evaluate missing slots after DB fallback
            if len(selected_master_items) >= session.question_count:
                missing_slots = []

        # Step 3: Trigger AI Question Factory ONLY if Master Bank is completely exhausted
        if missing_slots and len(selected_master_items) < session.question_count:
            current_session_texts = [duplicate_detector.normalize_text(q.question_text) for q in selected_master_items]
            logger.info(
                "PaperBuilder: %d missing slots out of %d. Triggering AI Question Factory with candidate_id=%s, current_session_texts_count=%d...",
                len(missing_slots), session.question_count, session.candidate_id or "N/A", len(current_session_texts)
            )
            try:
                import asyncio
                newly_generated = await asyncio.wait_for(
                    question_factory.generate_and_store_questions(
                        db=db,
                        blueprint_slots=missing_slots,
                        candidate_id=session.candidate_id,
                        scoped_normalized_texts=current_session_texts,
                        created_by="ai_factory"
                    ),
                    timeout=4.0
                )
                selected_master_items.extend(newly_generated)
            except Exception as e:
                logger.warning("AI Question Factory timeout or notice: %s. Using DB pool.", e)

        # Ensure we have exact required count
        if len(selected_master_items) < session.question_count:
            session.status = "generation_failed"
            await db.commit()
            remaining_needed = session.question_count - len(selected_master_items)
            health = ai_provider.health_status()
            logger.error(
                "ASSESSMENT GENERATION PARTIAL FAILURE | Session: %s | Obtained: %d/%d | Remaining Questions: %d | AI Health Status: %s",
                session.id[:8], len(selected_master_items), session.question_count, remaining_needed, health
            )
            raise RuntimeError(
                f"Could not build assessment paper for session {session.id[:8]}: "
                f"Obtained {len(selected_master_items)} of {session.question_count} required questions. "
                f"Remaining Questions Needed: {remaining_needed}. Provider Telemetry: {health}. Please retry."
            )

        selected_master_items = selected_master_items[:session.question_count]

        # Step 4: Populate AssessmentQuestion DB rows via bulk insert
        t_q_start = time.perf_counter()
        db_questions: List[AssessmentQuestion] = []
        for order_idx, master_q in enumerate(selected_master_items, start=1):
            record = AssessmentQuestion(
                session_id=session.id,
                order_index=order_idx,
                category=master_q.topic,
                topic=master_q.topic,
                question_text=master_q.question_text,
                code_snippet=master_q.code_snippet,
                options=master_q.options,
                correct_option=master_q.correct_option,
                explanation=master_q.explanation or "Detailed technical explanation available.",
                negative_marks=session.negative_marking,
            )
            db_questions.append(record)

        db.add_all(db_questions)
        await db.flush()
        q_write_ms = round((time.perf_counter() - t_q_start) * 1000, 1)

        # Step 5: Update Candidate & Recruiter History Ledgers via bulk insert
        t_hist_start = time.perf_counter()
        history_records: List[Any] = []
        prior_attempts = 0
        if session.candidate_id:
            prior_attempts = len((await db.execute(
                select(AssessmentSession.id).where(
                    AssessmentSession.candidate_id == session.candidate_id,
                    AssessmentSession.id != session.id,
                )
            )).scalars().all())

            existing_candidate_fps = set((await db.execute(
                select(AssessmentQuestionHistory.question_fingerprint)
                .where(AssessmentQuestionHistory.candidate_id == session.candidate_id)
            )).scalars().all())

            for record in db_questions:
                fp = duplicate_detector.compute_fingerprint(record.question_text)
                if fp not in existing_candidate_fps:
                    history_records.append(AssessmentQuestionHistory(
                        candidate_id=session.candidate_id,
                        session_id=session.id,
                        question_id=record.id,
                        question_fingerprint=fp,
                        normalized_question=duplicate_detector.normalize_text(record.question_text),
                        topic=record.topic,
                        difficulty=session.difficulty,
                        attempt_number=prior_attempts + 1,
                    ))
                    existing_candidate_fps.add(fp)

        if session.recruiter_id:
            existing_recruiter_fps = set((await db.execute(
                select(RecruiterAssessmentHistory.question_fingerprint)
                .where(RecruiterAssessmentHistory.recruiter_id == session.recruiter_id)
            )).scalars().all())

            for record in db_questions:
                fp = duplicate_detector.compute_fingerprint(record.question_text)
                if fp not in existing_recruiter_fps:
                    history_records.append(RecruiterAssessmentHistory(
                        recruiter_id=session.recruiter_id,
                        session_id=session.id,
                        question_id=record.id,
                        question_fingerprint=fp,
                    ))
                    existing_recruiter_fps.add(fp)

        if history_records:
            db.add_all(history_records)

        session.status = "active"
        await db.commit()
        hist_write_ms = round((time.perf_counter() - t_hist_start) * 1000, 1)

        total_latency_ms = round((time.perf_counter() - start_time) * 1000, 1)
        logger.info(
            "==========================================\n"
            "PAPER BUILDER TIMING PROFILE SUMMARY\n"
            "  Session ID                    : %s\n"
            "  Total Requested Questions     : %d\n"
            "  Master QB Reuse Count         : %d\n"
            "  AI Generated Count            : %d\n"
            "  Assessment Questions Write    : %.1f ms\n"
            "  History Ledger Write          : %.1f ms\n"
            "  TOTAL END-TO-END LATENCY      : %.1f ms (%.2f s)\n"
            "==========================================",
            session.id, session.question_count, len(selected_master_items) - len(missing_slots), len(missing_slots),
            q_write_ms, hist_write_ms, total_latency_ms, total_latency_ms / 1000.0
        )

        return db_questions

        return db_questions


paper_builder = PaperBuilder()
