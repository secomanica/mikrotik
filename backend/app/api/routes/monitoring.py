from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.device import Device
from app.services.mikrotik_client import RouterOSClient

router = APIRouter(prefix="/devices/{device_id}/monitor", tags=["Monitoramento"])


async def _get_device_client(device_id: int, db: AsyncSession) -> tuple[Device, RouterOSClient]:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return device, RouterOSClient(device)


@router.get("/resources")
async def get_resources(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """System resources: CPU, memory, uptime, etc."""
    _, client = await _get_device_client(device_id, db)
    result = await client.get("system/resource")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao consultar dispositivo"))
    return result["data"]


@router.get("/health")
async def get_health(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """System health: voltage, temperature, fan speed."""
    _, client = await _get_device_client(device_id, db)
    result = await client.get("system/health")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao consultar dispositivo"))
    return result["data"]


@router.get("/interfaces")
async def get_interfaces(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Interface list with traffic stats."""
    _, client = await _get_device_client(device_id, db)
    result = await client.get("interface")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao consultar dispositivo"))
    return result["data"]


@router.get("/traffic")
async def get_traffic(
    device_id: int,
    interface: str = "ether1",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Traffic stats for a specific interface."""
    _, client = await _get_device_client(device_id, db)
    result = await client.command("interface/monitor-traffic", {
        "interface": interface,
        "once": "",
    })
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao consultar dispositivo"))
    return result["data"]


@router.get("/overview")
async def get_overview(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated overview: resources + health + identity + interfaces."""
    device, client = await _get_device_client(device_id, db)

    resources = await client.get("system/resource")
    identity = await client.get("system/identity")
    health = await client.get("system/health")
    interfaces = await client.get("interface")

    return {
        "device": {"id": device.id, "name": device.name, "host": device.host},
        "identity": identity.get("data") if identity["success"] else None,
        "resources": resources.get("data") if resources["success"] else None,
        "health": health.get("data") if health["success"] else None,
        "interfaces": interfaces.get("data") if interfaces["success"] else None,
        "online": resources["success"],
    }


@router.get("/logs")
async def get_logs(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Device system logs."""
    _, client = await _get_device_client(device_id, db)
    result = await client.get("log")
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao consultar dispositivo"))
    return result["data"]
