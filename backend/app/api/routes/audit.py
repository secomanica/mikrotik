from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Auditoria"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    device_id: int | None = None,
    user_id: int | None = None,
    action: str | None = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(desc(AuditLog.created_at))

    if device_id is not None:
        query = query.where(AuditLog.device_id == device_id)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
