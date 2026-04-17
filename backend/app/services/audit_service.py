from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.models.user import User


async def log_action(
    db: AsyncSession,
    user: User,
    action: str,
    resource: str,
    device_id: int | None = None,
    device_name: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
):
    log = AuditLog(
        user_id=user.id,
        username=user.username,
        device_id=device_id,
        device_name=device_name,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    await db.flush()
