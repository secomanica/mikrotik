from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.device import Device
from app.services.mikrotik_client import RouterOSClient

router = APIRouter(prefix="/devices/{device_id}/tools", tags=["Ferramentas"])


class PingRequest(BaseModel):
    address: str
    count: int = 4
    size: int = 64
    interface: Optional[str] = None


class TracerouteRequest(BaseModel):
    address: str
    count: int = 1
    size: int = 64


class BandwidthTestRequest(BaseModel):
    address: str
    protocol: str = "tcp"
    direction: str = "both"
    duration: int = 10


class TorchRequest(BaseModel):
    interface: str
    duration: int = 5
    src_address: Optional[str] = None
    dst_address: Optional[str] = None


async def _get_client(device_id: int, db: AsyncSession) -> RouterOSClient:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return RouterOSClient(device)


@router.post("/ping")
async def run_ping(
    device_id: int,
    request: PingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(device_id, db)
    data = {"address": request.address, "count": str(request.count), "size": str(request.size)}
    if request.interface:
        data["interface"] = request.interface
    result = await client.command("tool/ping", data)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao executar ping"))
    return result["data"]


@router.post("/traceroute")
async def run_traceroute(
    device_id: int,
    request: TracerouteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(device_id, db)
    data = {"address": request.address, "count": str(request.count), "size": str(request.size)}
    result = await client.command("tool/traceroute", data)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao executar traceroute"))
    return result["data"]


@router.post("/bandwidth-test")
async def run_bandwidth_test(
    device_id: int,
    request: BandwidthTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(device_id, db)
    data = {
        "address": request.address,
        "protocol": request.protocol,
        "direction": request.direction,
        "duration": str(request.duration),
    }
    result = await client.command("tool/bandwidth-test", data)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao executar bandwidth test"))
    return result["data"]


@router.post("/torch")
async def run_torch(
    device_id: int,
    request: TorchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(device_id, db)
    data = {"interface": request.interface, "duration": str(request.duration)}
    if request.src_address:
        data["src-address"] = request.src_address
    if request.dst_address:
        data["dst-address"] = request.dst_address
    result = await client.command("tool/torch", data)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "Erro ao executar torch"))
    return result["data"]
