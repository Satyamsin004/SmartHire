from fastapi import APIRouter, Depends
from app.services.coding_service import coding_service
from app.schemas.domain import CodeRunRequest, CodeRunResponse
from app.dependencies.auth import get_current_user
from app.models.domain import User

router = APIRouter(prefix="/coding", tags=["Coding Environment"])

@router.post("/run", response_model=CodeRunResponse)
async def execute_code(
    body: CodeRunRequest,
    user: User = Depends(get_current_user)
):
    result = coding_service.run_code(body.language, body.code, body.problem_id or "two-sum")
    return result
