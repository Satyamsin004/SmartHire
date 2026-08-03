from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
from typing import Optional
from app.models.domain import User, Candidate, Recruiter, Admin

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id, User.deleted_at == None))
        return result.scalars().first()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email, User.deleted_at == None))
        return result.scalars().first()

    async def create_user(
        self,
        email: str,
        password_hash: str,
        full_name: str,
        role: str = "candidate",
        provider: str = "local",
        is_verified: bool = False
    ) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            role=role.lower(),
            provider=provider,
            is_verified=is_verified
        )
        self.db.add(user)
        await self.db.flush()

        role_str = role.lower()
        if role_str == "candidate":
            self.db.add(Candidate(user_id=user.id))
        elif role_str == "recruiter":
            self.db.add(Recruiter(user_id=user.id))
        elif role_str == "admin":
            self.db.add(Admin(user_id=user.id))

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_last_login(self, user_id: str):
        user = await self.get_by_id(user_id)
        if user:
            user.last_login = datetime.utcnow()
            await self.db.commit()

    async def set_verified(self, user_id: str):
        user = await self.get_by_id(user_id)
        if user:
            user.is_verified = True
            await self.db.commit()

    async def update_password(self, user_id: str, new_password_hash: str):
        user = await self.get_by_id(user_id)
        if user:
            user.password_hash = new_password_hash
            await self.db.commit()
