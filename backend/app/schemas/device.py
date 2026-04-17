from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DeviceCreate(BaseModel):
    name: str
    client_id: Optional[int] = None
    host: str
    api_port: int = 443
    use_ssl: bool = True
    username: str
    password: str
    public_ip: Optional[str] = None
    ssh_port: Optional[int] = 22
    winbox_port: Optional[int] = 8291
    notes: Optional[str] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    client_id: Optional[int] = None
    host: Optional[str] = None
    api_port: Optional[int] = None
    use_ssl: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    public_ip: Optional[str] = None
    ssh_port: Optional[int] = None
    winbox_port: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    client_id: Optional[int] = None
    host: str
    api_port: int
    use_ssl: bool
    username: str
    public_ip: Optional[str] = None
    ssh_port: Optional[int] = None
    winbox_port: Optional[int] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    ros_version: Optional[str] = None
    board_name: Optional[str] = None
    identity: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: int
    # Enriched
    client_name: Optional[str] = None

    model_config = {"from_attributes": True}


class DeviceStatus(BaseModel):
    id: int
    name: str
    host: str
    online: bool
    uptime: Optional[str] = None
    cpu_load: Optional[int] = None
    memory_used: Optional[int] = None
    memory_total: Optional[int] = None
    hdd_used: Optional[int] = None
    hdd_total: Optional[int] = None
    ros_version: Optional[str] = None
    board_name: Optional[str] = None
    architecture: Optional[str] = None
