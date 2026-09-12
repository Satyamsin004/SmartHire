import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.domain import ScheduledInterview, ReminderScheduleLog, Notification, User, Candidate
from app.services.email_service import email_service
from app.core.config import settings

logger = logging.getLogger("smarthire.reminder_service")

class ReminderService:
    """Manages interview reminder schedules, idempotency, invalidation on cancel/reschedule,
    and automatic dispatch of in-app notifications and emails.
    """

    REMINDER_OFFSETS = {
        "24H": timedelta(hours=24),
        "1H": timedelta(hours=1),
        "15M": timedelta(minutes=15)
    }

    @classmethod
    async def schedule_reminders_for_interview(
        cls,
        db: AsyncSession,
        interview: ScheduledInterview,
        candidate_user_id: Optional[str] = None
    ) -> List[ReminderScheduleLog]:
        """Creates 24H, 1H, and 15M reminder schedule records for an interview."""
        if not interview.scheduled_date:
            return []

        # Resolve candidate user ID if not provided
        if not candidate_user_id and interview.candidate_id:
            res_c = await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))
            cand = res_c.scalar_one_or_none()
            if cand:
                candidate_user_id = cand.user_id

        now = datetime.utcnow()
        scheduled_logs = []

        for r_type, offset in cls.REMINDER_OFFSETS.items():
            remind_at = interview.scheduled_date - offset
            idempotency_key = f"{interview.id}_{r_type}"

            # Check if reminder already exists
            stmt = select(ReminderScheduleLog).where(ReminderScheduleLog.idempotency_key == idempotency_key)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            # If reminder was in past at creation time, mark SKIPPED to avoid spamming
            status = "SKIPPED" if remind_at <= now else "PENDING"

            if not existing:
                log_entry = ReminderScheduleLog(
                    interview_id=interview.id,
                    candidate_user_id=candidate_user_id,
                    reminder_type=r_type,
                    scheduled_for=remind_at,
                    idempotency_key=idempotency_key,
                    status=status
                )
                db.add(log_entry)
                scheduled_logs.append(log_entry)
            elif existing.status == "CANCELLED" and status == "PENDING":
                existing.status = "PENDING"
                existing.scheduled_for = remind_at
                scheduled_logs.append(existing)

        await db.flush()
        logger.info(
            "[Reminder Service] Scheduled %d reminder(s) for interview %s (Interview Date: %s)",
            len(scheduled_logs), interview.id, interview.scheduled_date
        )
        return scheduled_logs

    @classmethod
    async def invalidate_reminders(
        cls,
        db: AsyncSession,
        interview_id: str,
        reason: str = "CANCELLED"
    ) -> int:
        """Cancels or skips all pending reminders for an interview when cancelled or completed."""
        stmt = (
            select(ReminderScheduleLog)
            .where(
                ReminderScheduleLog.interview_id == interview_id,
                ReminderScheduleLog.status == "PENDING"
            )
        )
        res = await db.execute(stmt)
        reminders = res.scalars().all()

        for r in reminders:
            r.status = reason
            r.updated_at = datetime.utcnow()

        await db.flush()
        logger.info("[Reminder Service] Invalidated %d pending reminder(s) for interview %s (%s)", len(reminders), interview_id, reason)
        return len(reminders)

    @classmethod
    async def reschedule_reminders(
        cls,
        db: AsyncSession,
        interview: ScheduledInterview,
        candidate_user_id: Optional[str] = None
    ) -> List[ReminderScheduleLog]:
        """Invalidates old reminders and registers new ones when an interview is rescheduled."""
        # Invalidate old pending
        await cls.invalidate_reminders(db, interview.id, reason="CANCELLED")

        # Create fresh reminders with versioned or updated timestamp keys
        if not candidate_user_id and interview.candidate_id:
            res_c = await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))
            cand = res_c.scalar_one_or_none()
            if cand:
                candidate_user_id = cand.user_id

        now = datetime.utcnow()
        new_logs = []
        date_stamp = interview.scheduled_date.strftime("%Y%m%d%H%M") if interview.scheduled_date else "resched"

        for r_type, offset in cls.REMINDER_OFFSETS.items():
            remind_at = interview.scheduled_date - offset
            idempotency_key = f"{interview.id}_{r_type}_{date_stamp}"
            status = "SKIPPED" if remind_at <= now else "PENDING"

            log_entry = ReminderScheduleLog(
                interview_id=interview.id,
                candidate_user_id=candidate_user_id,
                reminder_type=r_type,
                scheduled_for=remind_at,
                idempotency_key=idempotency_key,
                status=status
            )
            db.add(log_entry)
            new_logs.append(log_entry)

        await db.flush()
        logger.info("[Reminder Service] Rescheduled %d reminder(s) for interview %s", len(new_logs), interview.id)
        return new_logs

    @classmethod
    async def process_due_reminders(cls, db: AsyncSession) -> Dict[str, Any]:
        """Scans and dispatches all due reminders across all active scheduled interviews.
        Dispatches both In-App Notification and Email Notification.
        """
        now = datetime.utcnow()
        stmt = (
            select(ReminderScheduleLog)
            .where(
                ReminderScheduleLog.status == "PENDING",
                ReminderScheduleLog.scheduled_for <= now
            )
        )
        res = await db.execute(stmt)
        due_reminders = res.scalars().all()

        dispatched_count = 0
        skipped_count = 0
        error_count = 0

        for reminder in due_reminders:
            try:
                # 1. Fetch interview and verify still active
                res_i = await db.execute(
                    select(ScheduledInterview).where(ScheduledInterview.id == reminder.interview_id)
                )
                interview = res_i.scalar_one_or_none()

                if not interview:
                    reminder.status = "SKIPPED"
                    skipped_count += 1
                    continue

                if interview.status.lower() in ("completed", "cancelled", "expired"):
                    reminder.status = "SKIPPED"
                    skipped_count += 1
                    continue

                # 2. Fetch candidate user
                user = None
                cand = None
                if reminder.candidate_user_id:
                    res_u = await db.execute(select(User).where(User.id == reminder.candidate_user_id))
                    user = res_u.scalar_one_or_none()
                elif interview.candidate_id:
                    res_c = await db.execute(select(Candidate).where(Candidate.id == interview.candidate_id))
                    cand = res_c.scalar_one_or_none()
                    if cand and cand.user_id:
                        res_u = await db.execute(select(User).where(User.id == cand.user_id))
                        user = res_u.scalar_one_or_none()

                if not user:
                    reminder.status = "SKIPPED"
                    skipped_count += 1
                    continue

                cfg = interview.config_json or {}
                job_title = cfg.get("job_title") or interview.round_type or "Interview"
                company_name = cfg.get("company_name") or "SmartHire AI Platform"
                sched_str = interview.scheduled_date.strftime("%b %d, %Y at %I:%M %p") if interview.scheduled_date else "Soon"

                time_label_map = {
                    "24H": "in 24 hours",
                    "1H": "in 1 hour",
                    "15M": "in 15 minutes"
                }
                time_label = time_label_map.get(reminder.reminder_type, "soon")
                interview_link = f"{settings.FRONTEND_URL}/interview-lobby?schedule_id={interview.id}"

                # 3. Create In-App Notification
                in_app_notif = Notification(
                    user_id=user.id,
                    title=f"⏰ Interview Reminder: Starting {time_label}",
                    message=f"Your {job_title} ({interview.round_type}) interview with {company_name} is scheduled {time_label} ({sched_str}).",
                    notification_type="interview_reminder",
                    interview_id=interview.id,
                    link=f"/interview-lobby?schedule_id={interview.id}"
                )
                db.add(in_app_notif)

                # 4. Dispatch Email Notification
                await email_service.send_interview_reminder_email(
                    db=db,
                    candidate_email=user.email,
                    candidate_name=user.full_name or "Candidate",
                    interview_title=job_title,
                    scheduled_date_str=sched_str,
                    time_until_str=time_label,
                    interview_link=interview_link,
                    company_name=company_name,
                    reminder_type=reminder.reminder_type,
                    interview_id=interview.id,
                    candidate_user_id=user.id
                )

                reminder.status = "SENT"
                reminder.sent_at = datetime.utcnow()
                dispatched_count += 1

            except Exception as e:
                logger.error("[Reminder Service] Error processing reminder %s: %s", reminder.id, e, exc_info=True)
                error_count += 1

        await db.commit()
        logger.info(
            "[Reminder Service] Finished scan: %d dispatched, %d skipped, %d errors",
            dispatched_count, skipped_count, error_count
        )
        return {
            "dispatched": dispatched_count,
            "skipped": skipped_count,
            "errors": error_count,
            "total_scanned": len(due_reminders)
        }

reminder_service = ReminderService()
