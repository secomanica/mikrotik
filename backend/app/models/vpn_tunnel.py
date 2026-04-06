from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from app.core.database import Base


class VPNTunnel(Base):
    """Represents a VPN tunnel between two MikroTik devices."""
    __tablename__ = "vpn_tunnels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    tunnel_type = Column(String(20), nullable=False)  # wireguard, ipsec, gre, ipip, eoip
    device_a_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    device_b_id = Column(Integer, ForeignKey("devices.id"), nullable=False)

    # Network configuration
    subnet = Column(String(50), nullable=True)  # Tunnel subnet e.g. 10.255.255.0/30
    device_a_tunnel_ip = Column(String(50), nullable=True)  # e.g. 10.255.255.1/30
    device_b_tunnel_ip = Column(String(50), nullable=True)  # e.g. 10.255.255.2/30
    device_a_endpoint = Column(String(255), nullable=True)  # Public IP/host of device A
    device_b_endpoint = Column(String(255), nullable=True)  # Public IP/host of device B
    device_a_port = Column(Integer, nullable=True)  # Listen port on device A
    device_b_port = Column(Integer, nullable=True)  # Listen port on device B

    # WireGuard-specific
    device_a_private_key = Column(String(255), nullable=True)  # Encrypted
    device_a_public_key = Column(String(255), nullable=True)
    device_b_private_key = Column(String(255), nullable=True)  # Encrypted
    device_b_public_key = Column(String(255), nullable=True)

    # IPSec-specific
    ipsec_secret = Column(String(255), nullable=True)  # Encrypted pre-shared key
    ipsec_proposal = Column(String(100), nullable=True)

    # Status
    status = Column(String(20), default="pending")  # pending, deployed, active, error
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, nullable=False)
