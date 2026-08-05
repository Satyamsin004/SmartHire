import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
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
