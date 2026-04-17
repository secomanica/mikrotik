from pydantic import BaseModel
from typing import Any, Optional


class MikrotikCommand(BaseModel):
    """Generic command to send to a MikroTik device via REST API."""
    path: str
    method: str = "GET"
    data: Optional[dict[str, Any]] = None
    query: Optional[dict[str, str]] = None


class MikrotikResponse(BaseModel):
    success: bool
    data: Any = None
    error: Optional[str] = None


class FirewallRule(BaseModel):
    chain: str
    action: str
    src_address: Optional[str] = None
    dst_address: Optional[str] = None
    protocol: Optional[str] = None
    dst_port: Optional[str] = None
    src_port: Optional[str] = None
    in_interface: Optional[str] = None
    out_interface: Optional[str] = None
    comment: Optional[str] = None
    disabled: Optional[bool] = False
    log: Optional[bool] = False
    log_prefix: Optional[str] = None
    connection_state: Optional[str] = None
    place_before: Optional[str] = None


class NatRule(BaseModel):
    chain: str
    action: str
    src_address: Optional[str] = None
    dst_address: Optional[str] = None
    protocol: Optional[str] = None
    dst_port: Optional[str] = None
    src_port: Optional[str] = None
    to_addresses: Optional[str] = None
    to_ports: Optional[str] = None
    in_interface: Optional[str] = None
    out_interface: Optional[str] = None
    comment: Optional[str] = None
    disabled: Optional[bool] = False


class IPAddress(BaseModel):
    address: str
    interface: str
    network: Optional[str] = None
    comment: Optional[str] = None
    disabled: Optional[bool] = False


class DHCPServer(BaseModel):
    name: str
    interface: str
    address_pool: str
    lease_time: Optional[str] = "1d"
    disabled: Optional[bool] = False


class StaticRoute(BaseModel):
    dst_address: str
    gateway: str
    distance: Optional[int] = 1
    comment: Optional[str] = None
    disabled: Optional[bool] = False


class DNSEntry(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    servers: Optional[str] = None
    allow_remote_requests: Optional[bool] = None


class SimpleQueue(BaseModel):
    name: str
    target: str
    max_limit: Optional[str] = None
    burst_limit: Optional[str] = None
    burst_threshold: Optional[str] = None
    burst_time: Optional[str] = None
    comment: Optional[str] = None
    disabled: Optional[bool] = False


class WireGuardPeer(BaseModel):
    interface: str
    public_key: str
    endpoint_address: Optional[str] = None
    endpoint_port: Optional[int] = None
    allowed_address: Optional[str] = None
    persistent_keepalive: Optional[int] = None
    comment: Optional[str] = None
    disabled: Optional[bool] = False
