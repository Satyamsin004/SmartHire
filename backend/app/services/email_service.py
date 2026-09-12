import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models.domain import EmailNotificationLog

logger = logging.getLogger("smarthire.email_service")

class EmailService:
    """Production email notification service with idempotency, controlled retry handling,
    audit logging, HTML/text templates, and graceful failure isolation.
    """

    MAX_RETRIES = 3

    @staticmethod
    def _is_live_smtp_configured() -> bool:
        """Checks if production SMTP host and non-placeholder credentials are provided."""
        if not settings.SMTP_HOST or settings.SMTP_HOST in ("localhost", "127.0.0.1"):
            return False
        if settings.SMTP_PASSWORD in ("smtp-app-password", "", None):
            return False
        return True

    @classmethod
    def _send_smtp_sync(cls, to_email: str, subject: str, html_content: str, text_content: str) -> bool:
        """Synchronous SMTP worker invoked via asyncio.to_thread to avoid blocking event loop."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL or "noreply@smarthire.ai"
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if not cls._is_live_smtp_configured():
            logger.info(
                "[Email Service: Simulation Mode] Delivered email to %s | Subject: '%s'",
                to_email, subject
            )
            return True

        # Live SMTP delivery
        try:
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                server.starttls()

            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            server.quit()
            logger.info("[Email Service] Live SMTP delivery succeeded to %s | Subject: %s", to_email, subject)
            return True
        except Exception as err:
            logger.warning("[Email Service] SMTP delivery failed to %s: %s", to_email, err)
            raise err

    @classmethod
    async def dispatch_email(
        cls,
        db: Optional[AsyncSession],
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        notification_type: str,
        idempotency_key: str,
        user_id: Optional[str] = None,
        interview_id: Optional[str] = None
    ) -> bool:
        """Dispatches an email with idempotency validation, retry loop, and persistent logging.
        Never raises unhandled exceptions to caller.
        """
        if not to_email:
            logger.warning("[Email Service] Skipping dispatch: missing recipient email.")
            return False

        # 1. Idempotency Check in DB
        if db:
            try:
                stmt = select(EmailNotificationLog).where(EmailNotificationLog.idempotency_key == idempotency_key)
                res = await db.execute(stmt)
                existing = res.scalar_one_or_none()
                if existing and existing.status == "SENT":
                    logger.info("[Email Service] Idempotent hit: %s already SENT. Skipping duplicate dispatch.", idempotency_key)
                    return True
            except Exception as e:
                logger.warning("[Email Service] DB idempotency check notice: %s", e)

        # 2. Retry delivery loop
        delivered = False
        last_error = None
        attempts = 0

        for attempt in range(1, cls.MAX_RETRIES + 1):
            attempts = attempt
            try:
                delivered = await asyncio.to_thread(
                    cls._send_smtp_sync,
                    to_email,
                    subject,
                    html_content,
                    text_content
                )
                if delivered:
                    break
            except Exception as e:
                last_error = str(e)
                if attempt < cls.MAX_RETRIES:
                    await asyncio.sleep(0.5 * attempt)

        # 3. Log to EmailNotificationLog
        if db:
            try:
                status = "SENT" if delivered else "FAILED"
                stmt = select(EmailNotificationLog).where(EmailNotificationLog.idempotency_key == idempotency_key)
                res = await db.execute(stmt)
                log_entry = res.scalar_one_or_none()

                if not log_entry:
                    log_entry = EmailNotificationLog(
                        user_id=user_id,
                        interview_id=interview_id,
                        notification_type=notification_type,
                        idempotency_key=idempotency_key,
                        recipient_email=to_email,
                        subject=subject,
                        body_preview=text_content[:250],
                        status=status,
                        retry_count=attempts,
                        failure_reason=last_error if not delivered else None,
                        sent_at=datetime.utcnow() if delivered else None
                    )
                    db.add(log_entry)
                else:
                    log_entry.status = status
                    log_entry.retry_count = attempts
                    log_entry.failure_reason = last_error if not delivered else None
                    if delivered:
                        log_entry.sent_at = datetime.utcnow()

                await db.commit()
            except Exception as log_err:
                logger.warning("[Email Service] Failed to persist email audit log: %s", log_err)

        return delivered

    # -------------------------------------------------------------------------
    # High-level domain email triggers
    # -------------------------------------------------------------------------

    @classmethod
    async def send_interview_scheduled_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        interview_title: str,
        scheduled_date_str: str,
        duration_minutes: int,
        round_type: str,
        interview_link: str,
        company_name: str = "SmartHire AI Platform",
        instructions: str = "Be present in a quiet room with a working webcam and microphone.",
        interview_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Interview Scheduled."""
        subject = f"Interview Scheduled: {interview_title} ({round_type}) with {company_name}"
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Your interview has been scheduled with {company_name}.\n\n"
            f"Position: {interview_title}\n"
            f"Round: {round_type}\n"
            f"Date & Time: {scheduled_date_str}\n"
            f"Duration: {duration_minutes} Minutes\n"
            f"Join Interview: {interview_link}\n\n"
            f"Instructions:\n{instructions}\n\n"
            f"Good luck!\nSmartHire AI Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="border-bottom: 2px solid #4F46E5; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="color: #1E1B4B; margin: 0;">SmartHire AI Interview Scheduled</h2>
                <p style="color: #64748B; font-size: 13px; margin: 4px 0 0 0;">Position: {interview_title} · {company_name}</p>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px;">Your upcoming interview round has been confirmed:</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0; font-size: 13px;"><strong>Round:</strong> {round_type}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Scheduled For:</strong> {scheduled_date_str}</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Duration:</strong> {duration_minutes} Minutes</p>
                <p style="margin: 4px 0; font-size: 13px;"><strong>Instructions:</strong> {instructions}</p>
            </div>
            <div style="margin: 24px 0; text-align: center;">
                <a href="{interview_link}" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Join Interview Room
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">Please test your microphone and camera prior to joining. Best regards, SmartHire AI Team.</p>
        </div>
        """
        idempotency_key = f"{interview_id}_SCHEDULED_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="interview_scheduled",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id,
            interview_id=interview_id
        )

    @classmethod
    async def send_interview_rescheduled_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        interview_title: str,
        new_date_str: str,
        duration_minutes: int,
        round_type: str,
        interview_link: str,
        company_name: str = "SmartHire AI Platform",
        interview_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Interview Rescheduled."""
        subject = f"Interview Rescheduled: {interview_title} ({round_type})"
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Your interview for {interview_title} has been rescheduled to a new time.\n\n"
            f"New Date & Time: {new_date_str}\n"
            f"Duration: {duration_minutes} Minutes\n"
            f"Join Interview: {interview_link}\n\n"
            f"SmartHire AI Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <h2 style="color: #D97706; margin-top: 0;">Interview Rescheduled</h2>
            <p style="color: #334155;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569;">Your interview for <strong>{interview_title}</strong> with {company_name} has been updated to the following time:</p>
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Updated Schedule:</strong> {new_date_str}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Duration:</strong> {duration_minutes} Minutes</p>
            </div>
            <div style="margin: 24px 0; text-align: center;">
                <a href="{interview_link}" style="background: #D97706; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Updated Schedule
                </a>
            </div>
        </div>
        """
        idempotency_key = f"{interview_id}_RESCHEDULED_{new_date_str.replace(' ', '_')}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="interview_rescheduled",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id,
            interview_id=interview_id
        )

    @classmethod
    async def send_interview_cancelled_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        interview_title: str,
        scheduled_date_str: str,
        company_name: str = "SmartHire AI Platform",
        interview_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Interview Cancelled."""
        subject = f"Interview Cancelled: {interview_title}"
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"We are notifying you that your interview for {interview_title} scheduled for {scheduled_date_str} has been cancelled.\n\n"
            f"If you have questions, please reach out to the recruiter.\n"
            f"SmartHire AI Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <h2 style="color: #DC2626; margin-top: 0;">Interview Cancelled</h2>
            <p style="color: #334155;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569;">Your interview for <strong>{interview_title}</strong> with {company_name} originally scheduled for <strong>{scheduled_date_str}</strong> has been cancelled.</p>
            <p style="color: #64748B; font-size: 13px;">All scheduled reminders for this session have been deactivated.</p>
        </div>
        """
        idempotency_key = f"{interview_id}_CANCELLED_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="interview_cancelled",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id,
            interview_id=interview_id
        )

    @classmethod
    async def send_interview_reminder_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        interview_title: str,
        scheduled_date_str: str,
        time_until_str: str,
        interview_link: str,
        company_name: str = "SmartHire AI Platform",
        reminder_type: str = "24H",
        interview_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Interview Reminder (24h, 1h, 15m)."""
        subject = f"Reminder: Your interview is {time_until_str} ({interview_title})"
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"This is a reminder that your interview for {interview_title} with {company_name} is scheduled {time_until_str}.\n\n"
            f"Scheduled Date: {scheduled_date_str}\n"
            f"Join Interview: {interview_link}\n\n"
            f"Preparation Checklist:\n"
            f"- Test webcam and microphone in Interview Lobby\n"
            f"- Ensure quiet, well-lit surroundings\n"
            f"- Have your resume and references ready\n\n"
            f"SmartHire AI Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <h3 style="color: #3730A3; margin: 0;">⏰ Interview Starting {time_until_str.upper()}</h3>
            </div>
            <p style="color: #334155;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569;">Your interview for <strong>{interview_title}</strong> with {company_name} will begin {time_until_str}.</p>
            <p style="color: #1E293B; font-size: 14px;"><strong>Time:</strong> {scheduled_date_str}</p>
            <div style="margin: 24px 0; text-align: center;">
                <a href="{interview_link}" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Enter Interview Room
                </a>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; font-size: 12px; color: #64748B;">
                <strong>Quick Tips:</strong>
                <ul style="margin: 6px 0 0 16px; padding: 0;">
                    <li>Keep your camera on and face clearly visible throughout the interview.</li>
                    <li>Avoid switching tabs to prevent automated integrity warnings.</li>
                </ul>
            </div>
        </div>
        """
        idempotency_key = f"{interview_id}_{reminder_type}_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type=f"interview_reminder_{reminder_type.lower()}",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id,
            interview_id=interview_id
        )

    @classmethod
    async def send_report_ready_email(
        cls,
        db: Optional[AsyncSession],
        recipient_email: str,
        recipient_name: str,
        interview_title: str,
        overall_score: float,
        recommendation: str,
        report_link: str,
        is_recruiter: bool = False,
        candidate_name: Optional[str] = None,
        interview_id: Optional[str] = None,
        recipient_user_id: Optional[str] = None
    ) -> bool:
        """Report Ready Email for Candidate or Recruiter."""
        if is_recruiter:
            subject = f"Evaluation Ready: {candidate_name or 'Candidate'} - {interview_title} ({overall_score:.1f}%)"
            salutation = f"Hello {recipient_name},"
            body_intro = f"The AI evaluation report for <strong>{candidate_name or 'the candidate'}</strong> is now finalized."
        else:
            subject = f"Your Interview Report is Ready: {interview_title} ({overall_score:.1f}%)"
            salutation = f"Hello {recipient_name},"
            body_intro = f"Your comprehensive AI evaluation report for <strong>{interview_title}</strong> is now available."

        text_content = (
            f"{salutation}\n\n"
            f"{body_intro.replace('<strong>', '').replace('</strong>', '')}\n\n"
            f"Overall Score: {overall_score:.1f}%\n"
            f"Status / Recommendation: {recommendation}\n"
            f"View Report: {report_link}\n\n"
            f"SmartHire AI Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
                <h3 style="color: #166534; margin: 0;">📊 Evaluation Report Ready</h3>
            </div>
            <p style="color: #334155;">{salutation}</p>
            <p style="color: #475569;">{body_intro}</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Overall Score:</strong> <span style="font-size: 18px; color: #4F46E5; font-weight: bold;">{overall_score:.1f}%</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Recommendation:</strong> <span style="font-weight: bold; color: #166534;">{recommendation}</span></p>
            </div>
            <div style="margin: 24px 0; text-align: center;">
                <a href="{report_link}" style="background: #166534; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Full Evaluation & PDF Report
                </a>
            </div>
        </div>
        """
        role_key = "RECRUITER" if is_recruiter else "CANDIDATE"
        idempotency_key = f"{interview_id}_REPORT_READY_{role_key}_{recipient_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=recipient_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="report_ready",
            idempotency_key=idempotency_key,
            user_id=recipient_user_id,
            interview_id=interview_id
        )

    @classmethod
    async def send_shortlist_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        company_name: str = "SmartHire Enterprise",
        ats_score: Optional[float] = None,
        dashboard_link: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        application_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Resume Shortlisted & Qualified."""
        subject = f"🎉 Congratulations! You have been Shortlisted for {job_title}"
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/applications"
        ats_text = f" with an exceptional ATS Match score of {ats_score:.1f}%" if ats_score else ""
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Great news! Your candidate profile and resume have been officially shortlisted{ats_text} for {job_title} at {company_name}.\n\n"
            f"The hiring team has advanced your application to the next evaluation stages.\n\n"
            f"Track your recruitment pipeline & view your status here:\n{dash_url}\n\n"
            f"Best regards,\nSmartHire AI Talent Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">🎉 Congratulations! You're Shortlisted</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                We are thrilled to let you know that your candidate profile and resume have been officially <strong>Shortlisted</strong>{ats_text} for the role of <strong>{job_title}</strong> at <strong>{company_name}</strong>.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Requisition:</strong> {job_title}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Company:</strong> {company_name}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #16A34A;"><strong>Status:</strong> Shortlisted & Active in Talent Pipeline</p>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                The recruiting team is currently preparing the next steps, including your online skills assessment and interview rounds.
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Application Dashboard
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                You received this email because you applied via SmartHire AI. If you have any questions, please visit your candidate portal.
            </p>
        </div>
        """
        idempotency_key = f"{application_id or 'SHORTLIST'}_{candidate_email}_{datetime.utcnow().strftime('%Y%m%d')}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="candidate_shortlisted",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_assessment_scheduled_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        duration_minutes: int,
        passing_score: float,
        topics: list,
        company_name: str = "SmartHire Enterprise",
        assessment_link: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> bool:
        """Candidate Email: Online Assessment Scheduled."""
        subject = f"⚡ Online Assessment Invitation: {job_title} (Passing: {passing_score:.0f}%)"
        assess_url = assessment_link or f"{settings.FRONTEND_URL}/applications"
        topics_str = ", ".join(topics) if topics else "Quantitative Aptitude, Logical Reasoning, Technical Concepts"
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"The recruiter has scheduled an Online Skills Assessment for your application to {job_title} at {company_name}.\n\n"
            f"Assessment Details:\n"
            f"- Duration: {duration_minutes} Minutes\n"
            f"- Passing Cutoff Score: {passing_score:.0f}%\n"
            f"- Topics: {topics_str}\n\n"
            f"Click here to access your assessment:\n{assess_url}\n\n"
            f"Best regards,\nSmartHire AI Talent Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #0284C7 0%, #2563EB 100%); border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">⚡ Online Assessment Scheduled</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                The hiring team for <strong>{job_title}</strong> at <strong>{company_name}</strong> has scheduled an online skills assessment to evaluate your technical and reasoning capabilities.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Role:</strong> {job_title}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Duration:</strong> {duration_minutes} Minutes</p>
                <p style="margin: 4px 0; font-size: 13px; color: #2563EB;"><strong>Passing Cutoff Score:</strong> <span style="font-weight: bold; font-size: 15px;">{passing_score:.0f}%</span></p>
                <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Topics:</strong> {topics_str}</p>
            </div>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{assess_url}" style="background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Open Assessment Portal
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                Please ensure a stable internet connection before launching the assessment session. Best regards, SmartHire AI.
            </p>
        </div>
        """
        idempotency_key = f"{session_id or 'ASSESS'}_SCHEDULED_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="assessment_scheduled",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_application_received_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        company_name: str = "SmartHire Enterprise",
        applied_date: Optional[str] = None,
        application_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        dashboard_link: Optional[str] = None
    ) -> bool:
        """Candidate Email: Job Application Received & Under Review."""
        subject = f"📥 Application Received: {job_title} at {company_name}"
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/applications"
        app_date_str = applied_date or datetime.utcnow().strftime("%B %d, %Y")
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Thank you for applying for the position of {job_title} at {company_name}.\n\n"
            f"We have successfully received your application on {app_date_str}. "
            f"Our automated AI screening engine and recruitment team will review your qualifications and keep you updated on your status.\n\n"
            f"Track your application status on your candidate portal:\n{dash_url}\n\n"
            f"Best regards,\nSmartHire Talent Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #1E293B 0%, #3B82F6 100%); border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">📥 Application Received</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Thank you for your interest in joining <strong>{company_name}</strong>. We have successfully received your application for the <strong>{job_title}</strong> role.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Role:</strong> {job_title}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Company:</strong> {company_name}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Submission Date:</strong> {app_date_str}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #2563EB;"><strong>Status:</strong> Under Review</p>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Our AI screening system is evaluating your profile against the role requirements. You will receive updates as your application progresses through our hiring pipeline.
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Application Status
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                You received this confirmation because an application was submitted with this email on SmartHire AI.
            </p>
        </div>
        """
        idempotency_key = f"{application_id or 'APP'}_RECEIVED_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="application_received",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_ats_rejected_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        company_name: str = "SmartHire Enterprise",
        ats_score: Optional[float] = None,
        missing_skills: Optional[list] = None,
        application_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        dashboard_link: Optional[str] = None
    ) -> bool:
        """Candidate Email: ATS Screening Feedback & Status Update."""
        subject = f"Application Update: {job_title} at {company_name}"
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/applications"
        skills_text = ""
        skills_html = ""
        if missing_skills and len(missing_skills) > 0:
            skills_list_str = ", ".join([str(s) for s in missing_skills[:5]])
            skills_text = f"\nKey skills recommended for future consideration: {skills_list_str}\n"
            skills_html = f"""
            <div style="background: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 14px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #991B1B;">Recommended Skills to Strengthen:</p>
                <p style="margin: 0; font-size: 13px; color: #7F1D1D;">{skills_list_str}</p>
            </div>
            """
        score_line = f" (ATS Match Score: {ats_score:.1f}%)" if ats_score is not None else ""
        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Thank you for taking the time to apply for the position of {job_title} at {company_name}.\n\n"
            f"After careful review of your application and automated resume match evaluation{score_line}, "
            f"we have decided not to advance your application to the interview rounds at this time.\n"
            f"{skills_text}\n"
            f"We encourage you to keep your profile updated on SmartHire and apply for future opportunities that align with your experience.\n\n"
            f"Candidate Portal:\n{dash_url}\n\n"
            f"Best regards,\nSmartHire Talent Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #475569 0%, #64748B 100%); border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">Application Update</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Thank you for your interest in <strong>{company_name}</strong> and for taking the time to apply for the <strong>{job_title}</strong> position.
            </p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                After thorough evaluation of your application and skill alignment{score_line}, we regret to inform you that we will not be moving forward with your candidacy for this specific role.
            </p>
            {skills_html}
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Our decision was difficult given the strong applicant pool. We encourage you to keep your profile active on SmartHire and apply for future roles that match your skill set.
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #475569; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Explore More Opportunities
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                We wish you the very best in your job search and career journey. SmartHire AI Talent Team.
            </p>
        </div>
        """
        idempotency_key = f"{application_id or 'APP'}_ATS_REJECT_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="ats_rejected",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_assessment_result_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        score: float,
        passing_score: float,
        passed: bool,
        company_name: str = "SmartHire Enterprise",
        section_scores: Optional[dict] = None,
        session_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        dashboard_link: Optional[str] = None
    ) -> bool:
        """Candidate Email: Online Assessment Result (Score & Pass/Fail Status)."""
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/applications"
        if passed:
            subject = f"🎉 Congratulations! You Passed the Assessment for {job_title} ({score:.0f}%)"
            banner_bg = "linear-gradient(135deg, #059669 0%, #10B981 100%)"
            banner_title = "🎉 Assessment Passed!"
            status_text = "PASSED"
            status_color = "#16A34A"
            next_step_msg = "Your score satisfies the required cutoff. The recruitment team has been notified and will proceed with scheduling your technical interview."
        else:
            subject = f"Online Assessment Results: {job_title} ({score:.0f}%)"
            banner_bg = "linear-gradient(135deg, #64748B 0%, #475569 100%)"
            banner_title = "Online Assessment Results"
            status_text = "NOT CLEARED"
            status_color = "#DC2626"
            next_step_msg = f"Your score of {score:.1f}% was below the required cutoff score of {passing_score:.0f}%. We appreciate your effort and encourage you to review topic suggestions in your portal."

        section_lines = []
        section_html_items = []
        if section_scores:
            for sec, sec_sc in section_scores.items():
                section_lines.append(f"  • {sec}: {sec_sc}%")
                section_html_items.append(
                    f"<div style='display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #475569;'>"
                    f"<span>{sec}</span><span style='font-weight: bold; color: #1E293B;'>{sec_sc}%</span></div>"
                )
        sections_txt_block = "\n".join(section_lines) if section_lines else "Overall evaluation recorded."
        sections_html_block = "".join(section_html_items) if section_html_items else "<p style='color: #64748B; font-size: 13px;'>Comprehensive evaluation recorded.</p>"

        text_content = (
            f"Hello {candidate_name},\n\n"
            f"Your online assessment for {job_title} at {company_name} has been evaluated.\n\n"
            f"Assessment Summary:\n"
            f"- Your Overall Score: {score:.1f}%\n"
            f"- Passing Cutoff: {passing_score:.0f}%\n"
            f"- Result Status: {status_text}\n\n"
            f"Section Breakdown:\n{sections_txt_block}\n\n"
            f"{next_step_msg}\n\n"
            f"View complete breakdown and feedback on your dashboard:\n{dash_url}\n\n"
            f"Best regards,\nSmartHire Assessment Team"
        )

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: {banner_bg}; border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">{banner_title}</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Your online assessment results for <strong>{job_title}</strong> at <strong>{company_name}</strong> are ready.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #E2E8F0; padding-bottom: 10px;">
                    <span style="font-size: 14px; color: #64748B; font-weight: 500;">Overall Score:</span>
                    <span style="font-size: 22px; font-weight: bold; color: {status_color};">{score:.1f}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-size: 13px; color: #64748B;">Cutoff Required:</span>
                    <span style="font-size: 13px; font-weight: 600; color: #334155;">{passing_score:.0f}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                    <span style="font-size: 13px; color: #64748B;">Final Outcome:</span>
                    <span style="font-size: 13px; font-weight: bold; color: {status_color};">{status_text}</span>
                </div>
                <div style="border-top: 1px dashed #CBD5E1; padding-top: 10px; margin-top: 6px;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase;">Section Breakdown:</p>
                    {sections_html_block}
                </div>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                {next_step_msg}
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Detailed Results
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                Automated evaluation provided by SmartHire AI Proctoring & Assessment Engine.
            </p>
        </div>
        """
        idempotency_key = f"{session_id or 'ASSESS'}_RESULT_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="assessment_result",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_pipeline_status_update_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        status: str,
        company_name: str = "SmartHire Enterprise",
        notes: Optional[str] = None,
        application_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        dashboard_link: Optional[str] = None
    ) -> bool:
        """Candidate Email: Pipeline Stage Transition & Recruiter Updates."""
        subject = f"Application Status Update: {job_title} ({status})"
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/applications"
        remarks_txt = f"\nRecruiter Note: {notes}\n" if notes else ""
        remarks_html = (
            f"<div style='background: #F8FAFC; border-left: 4px solid #4F46E5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;'>"
            f"<p style='margin: 0; font-size: 13px; color: #475569;'><strong>Note from Recruiter:</strong> {notes}</p>"
            f"</div>"
        ) if notes else ""

        text_content = (
            f"Hello {candidate_name},\n\n"
            f"There is an update regarding your application for {job_title} at {company_name}.\n\n"
            f"New Application Status: {status}\n"
            f"{remarks_txt}\n"
            f"Track your recruitment progress and review action items on your dashboard:\n{dash_url}\n\n"
            f"Best regards,\nSmartHire Talent Team"
        )
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); border-radius: 8px; padding: 18px 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="color: #FFFFFF; margin: 0; font-size: 20px;">Application Status Update</h2>
            </div>
            <p style="color: #334155; font-size: 15px;">Hello <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                The hiring team has updated your application status for the <strong>{job_title}</strong> role at <strong>{company_name}</strong>.
            </p>
            <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #4338CA; font-weight: 600;">Current Stage</span>
                <p style="margin: 6px 0 0 0; font-size: 20px; font-weight: bold; color: #3730A3;">{status}</p>
            </div>
            {remarks_html}
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Log in to your candidate dashboard to access interview schedules, assessment tools, and communication from the hiring team.
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #4F46E5; color: #FFFFFF; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    View Recruitment Dashboard
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                You received this email because your application status was modified in SmartHire AI.
            </p>
        </div>
        """
        idempotency_key = f"{application_id or 'STATUS'}_{status}_{candidate_email}_{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="pipeline_status_update",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    @classmethod
    async def send_offer_letter_email(
        cls,
        db: Optional[AsyncSession],
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        salary_offered: str,
        start_date: Optional[str] = None,
        offer_text: Optional[str] = None,
        company_name: str = "SmartHire Enterprise",
        offer_id: Optional[str] = None,
        candidate_user_id: Optional[str] = None,
        dashboard_link: Optional[str] = None
    ) -> bool:
        """Candidate Email: Official Offer Letter Issued."""
        subject = f"🎉 Official Job Offer: {job_title} at {company_name}"
        dash_url = dashboard_link or f"{settings.FRONTEND_URL}/offers"
        start_str = start_date or "To be mutually agreed upon"
        letter_snippet = offer_text or "We are thrilled to extend an official offer of employment to you!"

        text_content = (
            f"Dear {candidate_name},\n\n"
            f"Congratulations! On behalf of {company_name}, we are delighted to offer you the position of {job_title}.\n\n"
            f"Offer Summary:\n"
            f"- Position: {job_title}\n"
            f"- Compensation / Offered Salary: {salary_offered}\n"
            f"- Expected Start Date: {start_str}\n\n"
            f"Offer Details:\n{letter_snippet}\n\n"
            f"Please review and sign your formal offer letter on your SmartHire portal:\n{dash_url}\n\n"
            f"We are excited about the prospect of having you join our team!\n\n"
            f"Warm regards,\nSmartHire Leadership & Recruiting Team"
        )

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
            <div style="background: linear-gradient(135deg, #D97706 0%, #059669 100%); border-radius: 8px; padding: 22px 24px; margin-bottom: 24px; text-align: center;">
                <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; letter-spacing: -0.02em;">🎉 Official Job Offer!</h1>
                <p style="color: #FEF3C7; margin: 6px 0 0 0; font-size: 14px;">Welcome to the team</p>
            </div>
            <p style="color: #334155; font-size: 15px;">Dear <strong>{candidate_name}</strong>,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                We were thoroughly impressed by your skills, experience, and interview performance. On behalf of <strong>{company_name}</strong>, we are thrilled to formally offer you the position of <strong>{job_title}</strong>!
            </p>
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                <div style="margin-bottom: 10px;">
                    <span style="font-size: 12px; color: #166534; text-transform: uppercase; font-weight: 600;">Position Offered:</span>
                    <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold; color: #14532D;">{job_title}</p>
                </div>
                <div style="margin-bottom: 10px;">
                    <span style="font-size: 12px; color: #166534; text-transform: uppercase; font-weight: 600;">Offered Compensation:</span>
                    <p style="margin: 2px 0 0 0; font-size: 18px; font-weight: bold; color: #047857;">{salary_offered}</p>
                </div>
                <div>
                    <span style="font-size: 12px; color: #166534; text-transform: uppercase; font-weight: 600;">Proposed Start Date:</span>
                    <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 600; color: #14532D;">{start_str}</p>
                </div>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #64748B; text-transform: uppercase;">Message from Hiring Team:</p>
                <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">{letter_snippet}</p>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Please access your candidate dashboard to review the full details and formally accept your offer.
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="{dash_url}" style="background: #059669; color: #FFFFFF; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">
                    Review & Accept Offer Letter
                </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; border-top: 1px solid #F1F5F9; padding-top: 16px;">
                Congratulations once again! We look forward to working together. SmartHire AI Talent Team.
            </p>
        </div>
        """
        idempotency_key = f"{offer_id or 'OFFER'}_SENT_{candidate_email}"
        return await cls.dispatch_email(
            db=db,
            to_email=candidate_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            notification_type="offer_letter_sent",
            idempotency_key=idempotency_key,
            user_id=candidate_user_id
        )

    # -------------------------------------------------------------------------
    # Legacy Authentication Emails
    # -------------------------------------------------------------------------
    @staticmethod
    async def send_verification_email(email: str, token: str):
        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        logger.info(f"[Email Dispatch] Sent Account Verification to {email}: {verify_url}")
        return True

    @staticmethod
    async def send_password_reset_email(email: str, token: str):
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        logger.info(f"[Email Dispatch] Sent Password Reset Link to {email}: {reset_url}")
        return True

email_service = EmailService()
