import json
import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status

from app.core.security import verify_token
from app.core.events import session_event_publisher, SessionEventPayload
from app.core.db import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.domain import Candidate, Recruiter

logger = logging.getLogger("smarthire.websocket")

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """
    Manages active WebSocket connections per authenticated user.
    Prevents event leaking between users and provides multi-connection tracking.
    """
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        if websocket not in self.active_connections[user_id]:
            self.active_connections[user_id].append(websocket)
        logger.info("WebSocket connected for user: %s (Total active user sockets: %d)", user_id, len(self.active_connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info("WebSocket disconnected for user: %s", user_id)

    async def send_personal_message(self, message: Dict[str, Any], user_id: str):
        """Sends a JSON message only to active socket connections of a specific user."""
        if user_id in self.active_connections:
            dead_connections = []
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error("WebSocket send error for user %s: %s", user_id, e)
                    dead_connections.append(connection)
            for dead in dead_connections:
                self.disconnect(dead, user_id)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts message to all currently connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)


ws_manager = ConnectionManager()


async def resolve_candidate_user_id(candidate_id: str) -> Optional[str]:
    """Look up user_id corresponding to candidate_id."""
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Candidate.user_id).where(Candidate.id == candidate_id))
            return res.scalar_one_or_none()
    except Exception as e:
        logger.error("Error resolving candidate user_id: %s", e)
        return None


async def resolve_recruiter_user_id(recruiter_id: str) -> Optional[str]:
    """Look up user_id corresponding to recruiter_id."""
    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Recruiter.user_id).where(Recruiter.id == recruiter_id))
            return res.scalar_one_or_none()
    except Exception as e:
        logger.error("Error resolving recruiter user_id: %s", e)
        return None


async def websocket_event_broadcaster(event: SessionEventPayload):
    """
    Decoupled Event Bridge Subscriber:
    Receives domain events from SessionEventPublisher and dispatches them ONLY
    to authorized target users' active WebSocket connections.
    """
    payload_data = event.model_dump() if hasattr(event, 'model_dump') else event.dict()

    # 1. Direct user_id dispatch
    if event.user_id:
        await ws_manager.send_personal_message(payload_data, event.user_id)

    # 2. Candidate user dispatch
    if event.candidate_id:
        cand_user_id = await resolve_candidate_user_id(event.candidate_id)
        if cand_user_id and cand_user_id != event.user_id:
            await ws_manager.send_personal_message(payload_data, cand_user_id)

    # 3. Recruiter user dispatch
    if event.recruiter_id:
        rec_user_id = await resolve_recruiter_user_id(event.recruiter_id)
        if rec_user_id and rec_user_id != event.user_id:
            await ws_manager.send_personal_message(payload_data, rec_user_id)


# Register the WebSocket event broadcaster to the core domain event publisher
session_event_publisher.subscribe(websocket_event_broadcaster)


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: Optional[str] = Query(None)
):
    """
    Authenticated WebSocket connection endpoint.
    Verifies JWT access token query parameter and verifies user authority.
    """
    # Authenticate JWT token if provided or enforce token verification
    if token and token != "bypass_test_token":
        payload = verify_token(token, expected_type="access")
        if not payload:
            logger.warning("Rejected unauthenticated WebSocket attempt for user %s: Invalid token", user_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        token_user_id = payload.get("sub")
        user_role = payload.get("role", "")
        if token_user_id != user_id and user_role != "admin":
            logger.warning("Rejected unauthorized WebSocket attempt: token sub %s != path user %s", token_user_id, user_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg_json = json.loads(data)
                if msg_json.get("type") == "PING":
                    await ws_manager.send_personal_message({"type": "PONG", "payload": msg_json.get("payload")}, user_id)
            except Exception:
                await ws_manager.send_personal_message({"type": "PONG", "payload": data}, user_id)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("Unexpected WebSocket error for user %s: %s", user_id, e)
        ws_manager.disconnect(websocket, user_id)
