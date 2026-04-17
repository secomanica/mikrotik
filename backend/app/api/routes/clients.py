from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_write, require_admin
from app.models.user import User
from app.models.client import Client
from app.models.device import Device
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.services.audit_service import log_action

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.get("", response_model=list[ClientResponse])
async def list_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).order_by(Client.name))
    clients = result.scalars().all()

    response = []
    for client in clients:
        client_dict = ClientResponse.model_validate(client)
        # Count devices for this client
        count_result = await db.execute(
            select(func.count(Device.id)).where(Device.client_id == client.id)
        )
        client_dict.device_count = count_result.scalar() or 0
        response.append(client_dict)
    return response


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Client).where((Client.name == client_data.name) | (Client.code == client_data.code))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cliente com este nome ou código já existe",
        )

    client = Client(
        name=client_data.name,
        code=client_data.code,
        contact_name=client_data.contact_name,
        contact_email=client_data.contact_email,
        contact_phone=client_data.contact_phone,
        address=client_data.address,
        notes=client_data.notes,
        created_by=current_user.id,
    )
    db.add(client)
    await db.flush()
    await db.refresh(client)

    await log_action(db, current_user, "CREATE", "clients", details=f"Criou cliente {client.name}")
    resp = ClientResponse.model_validate(client)
    resp.device_count = 0
    return resp


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    resp = ClientResponse.model_validate(client)
    count_result = await db.execute(
        select(func.count(Device.id)).where(Device.client_id == client.id)
    )
    resp.device_count = count_result.scalar() or 0
    return resp


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    client_data: ClientUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    update_data = client_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)

    db.add(client)
    await db.flush()
    await db.refresh(client)

    await log_action(db, current_user, "UPDATE", "clients", details=f"Atualizou cliente {client.name}")
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}")
async def delete_client(
    client_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    # Check if client has devices
    device_count = await db.execute(
        select(func.count(Device.id)).where(Device.client_id == client_id)
    )
    if (device_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Não é possível remover cliente com dispositivos associados. Remova os dispositivos primeiro.",
        )

    await db.delete(client)
    await log_action(db, current_user, "DELETE", "clients", details=f"Removeu cliente {client.name}")
    return {"message": "Cliente removido com sucesso"}
