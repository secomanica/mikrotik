from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.core.database import init_db, async_session
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api.routes import auth, users, devices, routeros_proxy, monitoring, tools, audit


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed admin user
    await init_db()
    await seed_admin()
    yield


async def seed_admin():
    """Create default admin user if no users exist."""
    async with async_session() as session:
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none() is None:
            admin = User(
                username="admin",
                email="admin@mikrotik-manager.local",
                full_name="Administrador",
                hashed_password=get_password_hash("admin"),
                role=UserRole.ADMIN,
            )
            session.add(admin)
            await session.commit()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Sistema de gestão web para dispositivos MikroTik RouterOS",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(routeros_proxy.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(tools.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
