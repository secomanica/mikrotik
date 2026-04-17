from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import encrypt_credential, decrypt_credential
from app.middleware.auth import get_current_user, require_write, require_admin
from app.models.user import User, UserRole
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse, DeviceStatus
from app.models.client import Client
from app.services.mikrotik_client import RouterOSClient
from app.services.audit_service import log_action

router = APIRouter(prefix="/devices", tags=["Dispositivos"])


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    client_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Device).order_by(Device.name)
    if client_id is not None:
        query = query.where(Device.client_id == client_id)
    result = await db.execute(query)
    devices = result.scalars().all()

    # Enrich with client names
    response = []
    for device in devices:
        device_dict = DeviceResponse.model_validate(device)
        if device.client_id:
            client_result = await db.execute(select(Client).where(Client.id == device.client_id))
            client = client_result.scalar_one_or_none()
            if client:
                device_dict.client_name = client.name
        response.append(device_dict)
    return response


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    device_data: DeviceCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    device = Device(
        name=device_data.name,
        client_id=device_data.client_id,
        host=device_data.host,
        api_port=device_data.api_port,
        use_ssl=device_data.use_ssl,
        username=device_data.username,
        password_encrypted=encrypt_credential(device_data.password),
        public_ip=device_data.public_ip,
        ssh_port=device_data.ssh_port,
        winbox_port=device_data.winbox_port,
        notes=device_data.notes,
        created_by=current_user.id,
    )
    db.add(device)
    await db.flush()
    await db.refresh(device)

    await log_action(
        db, current_user, "CREATE", "devices",
        device_id=device.id, device_name=device.name,
        details=f"Adicionou dispositivo {device.name} ({device.host})",
    )
    return device


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: int,
    device_data: DeviceUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    update_data = device_data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_encrypted"] = encrypt_credential(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(device, key, value)

    db.add(device)
    await db.flush()
    await db.refresh(device)

    await log_action(
        db, current_user, "UPDATE", "devices",
        device_id=device.id, device_name=device.name,
        details=f"Atualizou dispositivo {device.name}",
    )
    return device


@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    await db.delete(device)
    await log_action(
        db, current_user, "DELETE", "devices",
        device_id=device_id, device_name=device.name,
        details=f"Removeu dispositivo {device.name}",
    )
    return {"message": "Dispositivo removido com sucesso"}


@router.post("/{device_id}/test")
async def test_device_connection(
    device_id: int,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    client = RouterOSClient(device)
    test_result = await client.test_connection()

    if test_result["success"]:
        data = test_result["data"]
        device.ros_version = data.get("version")
        device.board_name = data.get("board-name")
        device.last_seen = datetime.now(timezone.utc)
        db.add(device)

    return test_result


@router.get("/{device_id}/status", response_model=DeviceStatus)
async def get_device_status(
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    client = RouterOSClient(device)
    res = await client.get_resources()

    if not res["success"]:
        return DeviceStatus(
            id=device.id, name=device.name, host=device.host, online=False
        )

    data = res["data"]
    device.last_seen = datetime.now(timezone.utc)
    device.ros_version = data.get("version")
    device.board_name = data.get("board-name")
    db.add(device)

    return DeviceStatus(
        id=device.id,
        name=device.name,
        host=device.host,
        online=True,
        uptime=data.get("uptime"),
        cpu_load=data.get("cpu-load"),
        memory_used=data.get("total-memory", 0) - data.get("free-memory", 0) if data.get("total-memory") else None,
        memory_total=data.get("total-memory"),
        hdd_used=data.get("total-hdd-space", 0) - data.get("free-hdd-space", 0) if data.get("total-hdd-space") else None,
        hdd_total=data.get("total-hdd-space"),
        ros_version=data.get("version"),
        board_name=data.get("board-name"),
        architecture=data.get("architecture-name"),
    )
