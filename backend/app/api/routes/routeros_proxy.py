"""
RouterOS REST API Proxy - The core proxy layer.

This catch-all endpoint translates webapp requests into RouterOS REST API calls.
All RouterOS functionality is accessible through this single proxy:

    GET    /api/devices/{id}/ros/{path}  -> GET  /rest/{path}  (list/read)
    PUT    /api/devices/{id}/ros/{path}  -> PUT  /rest/{path}  (create)
    PATCH  /api/devices/{id}/ros/{path}  -> PATCH /rest/{path} (update)
    DELETE /api/devices/{id}/ros/{path}  -> DELETE /rest/{path} (delete)
    POST   /api/devices/{id}/ros/{path}  -> POST /rest/{path}  (commands)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole
from app.models.device import Device
from app.services.mikrotik_client import RouterOSClient
from app.services.audit_service import log_action

router = APIRouter(tags=["RouterOS Proxy"])

# Paths that require admin role for write operations
ADMIN_ONLY_PATHS = [
    "system/reboot",
    "system/shutdown",
    "system/reset-configuration",
    "system/backup",
    "system/package",
    "user",
]


def enforce_permission(user: User, method: str, ros_path: str):
    """Enforce RBAC based on HTTP method and RouterOS path."""
    if user.role == UserRole.ADMIN:
        return

    if user.role == UserRole.READ_ONLY:
        if method != "GET":
            # Allow POST only for print-like commands (filtered reads)
            if method == "POST" and ros_path.endswith("/print"):
                return
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário somente leitura não pode executar esta operação",
            )
        return

    # READ_WRITE user
    if method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        # Check admin-only paths for destructive operations
        for admin_path in ADMIN_ONLY_PATHS:
            if ros_path.startswith(admin_path) and method != "GET":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta operação requer permissão de administrador",
                )


@router.api_route(
    "/devices/{device_id}/ros/{ros_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def proxy_routeros(
    device_id: int,
    ros_path: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Load device
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    # 2. Enforce RBAC
    enforce_permission(current_user, request.method, ros_path)

    # 3. Build and send request to RouterOS
    client = RouterOSClient(device)

    body = None
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            body = await request.json()
        except Exception:
            body = None

    # Forward query params
    params = dict(request.query_params) if request.query_params else None

    ros_result = await client.request(
        method=request.method,
        path=ros_path,
        params=params,
        json_body=body,
    )

    # 4. Audit log for write operations
    if request.method != "GET":
        details = f"{request.method} /{ros_path}"
        if body:
            # Sanitize - don't log passwords
            safe_body = {k: v for k, v in body.items() if "password" not in k.lower()}
            details += f" | data: {safe_body}"

        await log_action(
            db,
            current_user,
            action=request.method,
            resource=f"ros/{ros_path}",
            device_id=device.id,
            device_name=device.name,
            details=details,
            ip_address=request.client.host if request.client else None,
        )

    # 5. Return response
    return JSONResponse(
        status_code=ros_result.get("status_code", 200) if ros_result["success"] else (ros_result.get("status_code") or 502),
        content=ros_result,
    )
