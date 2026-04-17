import ssl
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.core.security import decrypt_credential
from app.models.device import Device


class RouterOSClient:
    """Async HTTP client for communicating with MikroTik RouterOS REST API.

    RouterOS 7.x REST API mapping:
        GET    /rest/{path}        -> print (list all)
        GET    /rest/{path}/*{id}  -> print single record
        PUT    /rest/{path}        -> add (create new record)
        PATCH  /rest/{path}/*{id}  -> set (update record)
        DELETE /rest/{path}/*{id}  -> remove (delete record)
        POST   /rest/{path}/{cmd}  -> execute command (enable, disable, print, etc.)
    """

    def __init__(self, device: Device):
        self.device = device
        scheme = "https" if device.use_ssl else "http"
        self.base_url = f"{scheme}://{device.host}:{device.api_port}/rest"
        self.username = device.username
        self.password = decrypt_credential(device.password_encrypted)

    def _get_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            auth=httpx.BasicAuth(self.username, self.password),
            verify=False,  # RouterOS uses self-signed certs by default
            timeout=httpx.Timeout(
                settings.MIKROTIK_REQUEST_TIMEOUT,
                connect=10.0,
            ),
        )

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, str]] = None,
        json_body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        async with self._get_client() as client:
            try:
                response = await client.request(
                    method=method.upper(),
                    url=url,
                    params=params,
                    json=json_body,
                )
                data = response.json() if response.content else None
                return {
                    "success": response.status_code < 400,
                    "status_code": response.status_code,
                    "data": data,
                    "error": data.get("detail", data.get("message")) if isinstance(data, dict) and response.status_code >= 400 else None,
                }
            except httpx.ConnectError:
                return {"success": False, "status_code": 0, "data": None, "error": "Não foi possível conectar ao dispositivo"}
            except httpx.TimeoutException:
                return {"success": False, "status_code": 0, "data": None, "error": "Timeout na conexão com o dispositivo"}
            except Exception as e:
                return {"success": False, "status_code": 0, "data": None, "error": str(e)}

    async def get(self, path: str, params: Optional[dict[str, str]] = None) -> dict:
        return await self.request("GET", path, params=params)

    async def create(self, path: str, data: dict[str, Any]) -> dict:
        return await self.request("PUT", path, json_body=data)

    async def update(self, path: str, item_id: str, data: dict[str, Any]) -> dict:
        return await self.request("PATCH", f"{path}/{item_id}", json_body=data)

    async def delete(self, path: str, item_id: str) -> dict:
        return await self.request("DELETE", f"{path}/{item_id}")

    async def command(self, path: str, data: Optional[dict[str, Any]] = None) -> dict:
        return await self.request("POST", path, json_body=data)

    async def test_connection(self) -> dict:
        """Test connectivity by fetching system resource info."""
        result = await self.get("system/resource")
        if result["success"] and result["data"]:
            return {
                "success": True,
                "data": {
                    "uptime": result["data"].get("uptime"),
                    "version": result["data"].get("version"),
                    "board-name": result["data"].get("board-name"),
                    "architecture-name": result["data"].get("architecture-name"),
                    "cpu-load": result["data"].get("cpu-load"),
                    "free-memory": result["data"].get("free-memory"),
                    "total-memory": result["data"].get("total-memory"),
                    "free-hdd-space": result["data"].get("free-hdd-space"),
                    "total-hdd-space": result["data"].get("total-hdd-space"),
                },
            }
        return result

    async def get_identity(self) -> dict:
        return await self.get("system/identity")

    async def get_resources(self) -> dict:
        return await self.get("system/resource")

    async def get_health(self) -> dict:
        return await self.get("system/health")

    async def get_interfaces(self) -> dict:
        return await self.get("interface")

    async def get_routes(self) -> dict:
        return await self.get("ip/route")

    async def get_firewall_filter(self) -> dict:
        return await self.get("ip/firewall/filter")

    async def get_firewall_nat(self) -> dict:
        return await self.get("ip/firewall/nat")
