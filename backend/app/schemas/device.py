from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DeviceCreate(BaseModel):
    name: str
    host: str
    port: int = 443
    use_ssl: bool = True
    username: str
    password: str
    notes: Optional[str] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    use_ssl: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    host: str
    port: int
    use_ssl: bool
    username: str
    model: Optional[str] = None
    serial_number: Optional[str] = None
    ros_version: Optional[str] = None
    board_name: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: int

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
