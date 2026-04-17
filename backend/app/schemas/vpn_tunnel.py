from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VPNTunnelCreate(BaseModel):
    name: str
    client_id: int
    tunnel_type: str  # wireguard, ipsec, gre, ipip, eoip
    device_a_id: int
    device_b_id: int
    subnet: Optional[str] = None
    device_a_tunnel_ip: Optional[str] = None
    device_b_tunnel_ip: Optional[str] = None
    device_a_endpoint: Optional[str] = None
    device_b_endpoint: Optional[str] = None
    device_a_port: Optional[int] = None
    device_b_port: Optional[int] = None
    # IPSec-specific
    ipsec_secret: Optional[str] = None
    ipsec_proposal: Optional[str] = None
    notes: Optional[str] = None


class VPNTunnelUpdate(BaseModel):
    name: Optional[str] = None
    device_a_endpoint: Optional[str] = None
    device_b_endpoint: Optional[str] = None
    device_a_port: Optional[int] = None
    device_b_port: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class VPNTunnelResponse(BaseModel):
    id: int
    name: str
    client_id: int
    tunnel_type: str
    device_a_id: int
    device_b_id: int
    subnet: Optional[str] = None
    device_a_tunnel_ip: Optional[str] = None
    device_b_tunnel_ip: Optional[str] = None
    device_a_endpoint: Optional[str] = None
    device_b_endpoint: Optional[str] = None
    device_a_port: Optional[int] = None
    device_b_port: Optional[int] = None
    device_a_public_key: Optional[str] = None
    device_b_public_key: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: int
    # Enriched fields
    device_a_name: Optional[str] = None
    device_b_name: Optional[str] = None
    client_name: Optional[str] = None

    model_config = {"from_attributes": True}


class VPNTunnelDeploy(BaseModel):
    """Request to deploy tunnel config to both devices."""
    add_firewall_rules: bool = True
    add_routes: bool = False
    routes_device_a: Optional[str] = None  # Networks to route through tunnel on device A
    routes_device_b: Optional[str] = None  # Networks to route through tunnel on device B
