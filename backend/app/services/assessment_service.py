import hashlib
import json
import logging
import random
import re
import time
import uuid
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import (
    AssessmentAnswer, AssessmentQuestion, AssessmentQuestionHistory,
    AssessmentResult, AssessmentSession, JobApplication, Candidate, Notification,
)
from app.services.ai_engine import ai_engine
from app.services.paper_builder import paper_builder

logger = logging.getLogger("smarthire.assessment")


class AssessmentGenerationError(RuntimeError):
    """Raised when the AI engine cannot produce a complete, valid, unique assessment paper."""


class AssessmentService:
    """Enterprise Assessment Paper Generation Engine (HackerRank / Mettl / SHL style)."""

    ALLOWED_QUESTION_COUNTS = {10, 20, 25, 30, 40, 50, 75, 100}
    MAX_DURATION_MINUTES = 180
    SIMILARITY_THRESHOLD = 0.48
    OPTIMAL_BATCH_SIZE = 10
    MAX_REGEN_PASSES = 6

    # Enterprise domain & context pools for prompt randomization
    ENTERPRISE_DOMAINS = [
        "FinTech High-Frequency Trading & Settlement Engine",
        "E-Commerce Microservices & Event-Driven Architecture",
        "Healthcare Distributed Telemetry Analytics",
        "SaaS Cloud Multi-Tenant Distributed Cache",
        "Logistics Real-Time Route & Inventory Optimization",
        "Stream Processing & Low-Latency Messaging Pipeline",
        "Zero-Trust Identity & Auth Gateway",
        "AI/ML High-Throughput Model Inference Pipeline"
    ]
    COMPANY_NAMES = ["Stripe", "Netflix", "Uber", "Datadog", "Cloudflare", "Shopify", "Atlassian", "Snowflake", "Amazon", "Google"]

    @staticmethod
    async def create_assessment_session(
        db: AsyncSession, candidate_id: Optional[str], title: str = "Aptitude & Technical Assessment",
        topics: Optional[List[str]] = None, difficulty: str = "Medium", question_count: int = 10,
        duration_minutes: int = 15, passing_score: float = 70.0, negative_marking: float = 0.25,
        proctoring_enabled: bool = True, is_recruiter_configured: bool = False,
        recruiter_id: Optional[str] = None, job_id: Optional[str] = None,
        job_application_id: Optional[str] = None,
    ) -> AssessmentSession:
        """Initializes a brand-new, unique assessment session."""
        cleaned_topics = list(dict.fromkeys(t.strip() for t in (topics or []) if t and t.strip()))
        if not cleaned_topics:
            raise ValueError("At least one assessment topic is required.")
        if question_count not in AssessmentService.ALLOWED_QUESTION_COUNTS:
            raise ValueError("Unsupported question count.")
        if not 5 <= duration_minutes <= AssessmentService.MAX_DURATION_MINUTES:
            raise ValueError("Duration must be between 5 and 180 minutes.")

        session = AssessmentSession(
            title=title, candidate_id=candidate_id, recruiter_id=recruiter_id, job_id=job_id,
            job_application_id=job_application_id, topics=cleaned_topics, difficulty=difficulty,
            question_count=question_count, duration_minutes=duration_minutes,
            passing_score=passing_score, negative_marking=negative_marking,
            proctoring_enabled=proctoring_enabled,
            is_recruiter_configured=is_recruiter_configured, status="generating",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    def normalize_question(text: str) -> str:
        return " ".join(re.findall(r"[a-z0-9+#.]+", (text or "").lower()))

    @classmethod
    def fingerprint(cls, text: str) -> str:
        return hashlib.sha256(cls.normalize_question(text).encode("utf-8")).hexdigest()

    @staticmethod
    def calculate_text_similarity(s1: str, s2: str) -> float:
        """Uses token-set overlap plus sequence similarity; values are in [0, 1]."""
        normalized_one = AssessmentService.normalize_question(s1)
        normalized_two = AssessmentService.normalize_question(s2)
        if not normalized_one or not normalized_two:
            return 0.0
        one_tokens, two_tokens = set(normalized_one.split()), set(normalized_two.split())
        jaccard = len(one_tokens & two_tokens) / len(one_tokens | two_tokens)
        sequence = SequenceMatcher(None, normalized_one, normalized_two).ratio()
        return max(jaccard, sequence)

    @staticmethod
    def _topic_quotas(topics: List[str], count: int) -> Dict[str, int]:
        base, remainder = divmod(count, len(topics))
        return {topic: base + (1 if index < remainder else 0) for index, topic in enumerate(topics)}

    @staticmethod
    def _valid_question(payload: Any) -> bool:
        if not isinstance(payload, dict):
            return False

        text = payload.get("question_text") or payload.get("question") or payload.get("text")
        options = payload.get("options") or payload.get("choices")
        answer = payload.get("correct_option")
        if answer is None:
            answer = payload.get("correct_answer") or payload.get("answer")

        if isinstance(text, str):
            payload["question_text"] = text.strip()

        if isinstance(options, list):
            payload["options"] = [str(opt).strip() for opt in options]

        if isinstance(answer, str):
            ans_clean = answer.strip().lower()
            mapping = {"a": 0, "b": 1, "c": 2, "d": 3, "0": 0, "1": 1, "2": 2, "3": 3}
            for k, v in mapping.items():
                if k in ans_clean:
                    answer = v
                    break

        if isinstance(answer, int) and 0 <= answer < 4:
            payload["correct_option"] = answer

        text_final = payload.get("question_text")
        opts_final = payload.get("options")
        ans_final = payload.get("correct_option")

        return (
            isinstance(text_final, str) and len(text_final.strip()) >= 15
            and isinstance(opts_final, list) and len(opts_final) == 4
            and all(isinstance(option, str) and option.strip() for option in opts_final)
            and isinstance(ans_final, int) and 0 <= ans_final < 4
        )

    @classmethod
    def _build_full_paper_prompt(
        cls, *, topics: List[str], difficulty: str, count: int, exclusions: List[str], pass_num: int
    ) -> str:
        excluded_excerpt = "\n".join(f"- {item}" for item in exclusions[-50:]) or "None"
        random_seed = uuid.uuid4().hex[:8]
        random_domain = random.choice(cls.ENTERPRISE_DOMAINS)
        random_company = random.choice(cls.COMPANY_NAMES)
        topic_distribution = ", ".join(f"{t}: {q}" for t, q in cls._topic_quotas(topics, count).items())

        return f"""
You are a Lead Assessment Author for enterprise evaluation platforms (HackerRank, Mercer Mettl, SHL style).
Generate exactly {count} NEW, unique, high-quality MCQs.

Assessment Specifications:
- Topic Quotas: {topic_distribution}
- Difficulty Level: {difficulty}
- Random Seed: {random_seed}
- Domain Context: {random_domain} (inspired by engineering standards at {random_company})
- Generation Pass: {pass_num}

Question Variety Guidelines:
- Rotate concept questions, scenario-based troubleshooting, code snippet output prediction, debugging, architectural trade-offs, and aptitude/reasoning.
- Distribute options (A, B, C, D) evenly as correct answers.
- Ensure all four options are plausible technical distractors.

Candidate Exclusion List:
The candidate has ALREADY received or been assigned the following questions. Do NOT repeat or closely paraphrase any of them:
{excluded_excerpt}

OUTPUT MANDATE:
Return ONLY a JSON array of exactly {count} objects. Do NOT output markdown code blocks or prose outside JSON.
Each object MUST match this schema:
{{
  "category": "Topic Name",
  "topic": "Topic Name",
  "question_text": "Detailed, clear question statement",
  "code_snippet": null,
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_option": 0,
  "explanation": "Concise explanation of the correct answer"
}}
"""

    @classmethod
    async def generate_questions_for_session(cls, db: AsyncSession, session_id: str) -> List[AssessmentQuestion]:
        """Generates an entire, unique assessment paper for a specific session using Master Question Bank & Paper Builder."""
        logger.info("ENTERPRISE PAPER BUILDER EXECUTED | session_id=%s", session_id)
        return await paper_builder.build_paper(db, session_id)

        return db_questions

    @staticmethod
    async def evaluate_assessment_submission(
        db: AsyncSession, session_id: str, answers_payload: List[Dict[str, Any]],
        proctoring_violations: int = 0,
    ) -> AssessmentResult:
        session = (await db.execute(select(AssessmentSession).where(AssessmentSession.id == session_id))).scalar_one_or_none()
        if not session:
            raise ValueError("Session not found.")
        session.status, session.violations_count = "completed", proctoring_violations
        questions = {q.id: q for q in (await db.execute(
            select(AssessmentQuestion).where(AssessmentQuestion.session_id == session_id)
        )).scalars().all()}
        total_correct = total_wrong = total_skipped = 0
        total_points = 0.0
        section_correct: Dict[str, int] = {}
        section_total: Dict[str, int] = {}
        weak_topics, strong_topics = set(), set()
        for answer in answers_payload:
            question = questions.get(answer.get("question_id"))
            if not question:
                continue
            section = question.category or "General"
            section_total[section] = section_total.get(section, 0) + 1
            selected = answer.get("selected_option")
            correct, points = False, 0.0
            if selected is None or selected < 0:
                total_skipped += 1
            elif selected == question.correct_option:
                total_correct += 1
                correct, points = True, 1.0
                total_points += points
                section_correct[section] = section_correct.get(section, 0) + 1
                strong_topics.add(question.topic)
            else:
                total_wrong += 1
                points = -abs(session.negative_marking)
                total_points += points
                weak_topics.add(question.topic)
            db.add(AssessmentAnswer(
                session_id=session_id, question_id=question.id, selected_option=selected,
                is_correct=correct, points_earned=points, time_taken_seconds=answer.get("time_taken_seconds", 0),
            ))
        total_questions = len(questions)
        overall_score = round(min(100.0, max(0.0, max(0.0, total_points) / max(1, total_questions) * 100)), 1)
        section_scores = {section: round(section_correct.get(section, 0) / total * 100, 1) for section, total in section_total.items()}
        recommendation = "Pass" if overall_score >= session.passing_score else "Fail"
        suggestions = [f"Review core concepts and practice additional problems in {topic}." for topic in list(weak_topics)[:3]]
        if not suggestions:
            suggestions = ["Outstanding technical and reasoning performance across all topics!"]
        result = (await db.execute(select(AssessmentResult).where(AssessmentResult.session_id == session_id))).scalars().first()
        fields = dict(
            candidate_id=session.candidate_id, overall_score=overall_score, total_correct=total_correct,
            total_wrong=total_wrong, total_skipped=total_skipped, section_scores=section_scores,
            weak_areas=list(weak_topics), strong_areas=list(strong_topics),
            improvement_suggestions=suggestions, hiring_recommendation=recommendation,
            proctoring_violations=proctoring_violations,
        )
        if result is None:
            result = AssessmentResult(session_id=session_id, **fields)
            db.add(result)
        else:
            for field, value in fields.items():
                setattr(result, field, value)
        if session.job_application_id:
            application = (await db.execute(select(JobApplication).where(JobApplication.id == session.job_application_id))).scalar_one_or_none()
            if application:
                new_status = "Assessment Passed" if recommendation == "Pass" else "Assessment Failed"
                application.status = new_status
                
                # Notify Candidate
                if session.candidate_id:
                    res_c = await db.execute(select(Candidate).where(Candidate.id == session.candidate_id))
                    cand = res_c.scalar_one_or_none()
                    if cand and cand.user_id:
                        notif = Notification(
                            user_id=cand.user_id,
                            title=f"Online Assessment {new_status}",
                            message=f"You scored {overall_score}% on your online assessment. Status: {new_status}.",
                            notification_type="assessment_completed"
                        )
                        db.add(notif)

        await db.commit()

        # Emit Real-Time Domain Events (Post DB Commit)
        try:
            from app.core.events import session_event_publisher, SessionEventPayload, SessionEventType
            await session_event_publisher.publish(SessionEventPayload(
                event_type=SessionEventType.ASSESSMENT_SUBMITTED,
                event="ASSESSMENT_SUBMITTED",
                session_id=session.id,
                candidate_id=session.candidate_id,
                recruiter_id=session.recruiter_id,
                job_application_id=session.job_application_id,
                job_id=session.job_id,
                status=session.status,
                metadata={
                    "overall_score": overall_score,
                    "hiring_recommendation": recommendation,
                    "passing_score": session.passing_score
                }
            ))
            await session_event_publisher.publish(SessionEventPayload(
                event_type=SessionEventType.ASSESSMENT_COMPLETED,
                event="ASSESSMENT_COMPLETED",
                session_id=session.id,
                candidate_id=session.candidate_id,
                recruiter_id=session.recruiter_id,
                job_application_id=session.job_application_id,
                job_id=session.job_id,
                status="completed",
                metadata={
                    "overall_score": overall_score,
                    "hiring_recommendation": recommendation
                }
            ))
        except Exception as event_err:
            logger.error("Failed to publish assessment event: %s", event_err)

        return result


assessment_service = AssessmentService()
