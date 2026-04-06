from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    host = Column(String(255), nullable=False)
    api_port = Column(Integer, default=443)  # REST API port (customizable)
    use_ssl = Column(Boolean, default=True)
    username = Column(String(100), nullable=False)
    password_encrypted = Column(String(500), nullable=False)
    # Additional connection options
    public_ip = Column(String(255), nullable=True)  # Public IP for VPN endpoints
    ssh_port = Column(Integer, default=22, nullable=True)
    winbox_port = Column(Integer, default=8291, nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    ros_version = Column(String(50), nullable=True)
    board_name = Column(String(100), nullable=True)
    identity = Column(String(100), nullable=True)
    notes = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, nullable=False)
