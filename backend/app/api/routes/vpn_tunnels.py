"""
VPN Tunnel management - Create secure connections between MikroTik devices.

Supports:
- WireGuard tunnels (recommended, modern, fast)
- IPSec site-to-site tunnels
- GRE tunnels
- IPIP tunnels
- EoIP tunnels

The deploy endpoint configures both MikroTik devices automatically via REST API.
"""

import secrets
import base64
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import encrypt_credential, decrypt_credential
from app.middleware.auth import get_current_user, require_write
from app.models.user import User
from app.models.device import Device
from app.models.client import Client
from app.models.vpn_tunnel import VPNTunnel
from app.schemas.vpn_tunnel import VPNTunnelCreate, VPNTunnelUpdate, VPNTunnelResponse, VPNTunnelDeploy
from app.services.mikrotik_client import RouterOSClient
from app.services.audit_service import log_action

router = APIRouter(prefix="/vpn-tunnels", tags=["VPN Tunnels"])


async def _enrich_tunnel(tunnel: VPNTunnel, db: AsyncSession) -> VPNTunnelResponse:
    resp = VPNTunnelResponse.model_validate(tunnel)
    # Fetch device names
    dev_a = await db.execute(select(Device).where(Device.id == tunnel.device_a_id))
    dev_b = await db.execute(select(Device).where(Device.id == tunnel.device_b_id))
    device_a = dev_a.scalar_one_or_none()
    device_b = dev_b.scalar_one_or_none()
    resp.device_a_name = device_a.name if device_a else None
    resp.device_b_name = device_b.name if device_b else None
    # Fetch client name
    client = await db.execute(select(Client).where(Client.id == tunnel.client_id))
    client_obj = client.scalar_one_or_none()
    resp.client_name = client_obj.name if client_obj else None
    return resp


@router.get("", response_model=list[VPNTunnelResponse])
async def list_tunnels(
    client_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(VPNTunnel).order_by(VPNTunnel.name)
    if client_id is not None:
        query = query.where(VPNTunnel.client_id == client_id)
    result = await db.execute(query)
    tunnels = result.scalars().all()
    return [await _enrich_tunnel(t, db) for t in tunnels]


@router.post("", response_model=VPNTunnelResponse, status_code=status.HTTP_201_CREATED)
async def create_tunnel(
    data: VPNTunnelCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    # Validate devices exist and belong to client
    dev_a = await db.execute(select(Device).where(Device.id == data.device_a_id))
    dev_b = await db.execute(select(Device).where(Device.id == data.device_b_id))
    device_a = dev_a.scalar_one_or_none()
    device_b = dev_b.scalar_one_or_none()

    if not device_a or not device_b:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    if data.device_a_id == data.device_b_id:
        raise HTTPException(status_code=400, detail="Os dispositivos devem ser diferentes")

    # Validate client exists
    client = await db.execute(select(Client).where(Client.id == data.client_id))
    if not client.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    tunnel = VPNTunnel(
        name=data.name,
        client_id=data.client_id,
        tunnel_type=data.tunnel_type,
        device_a_id=data.device_a_id,
        device_b_id=data.device_b_id,
        subnet=data.subnet,
        device_a_tunnel_ip=data.device_a_tunnel_ip,
        device_b_tunnel_ip=data.device_b_tunnel_ip,
        device_a_endpoint=data.device_a_endpoint or device_a.public_ip or device_a.host,
        device_b_endpoint=data.device_b_endpoint or device_b.public_ip or device_b.host,
        device_a_port=data.device_a_port,
        device_b_port=data.device_b_port,
        status="pending",
        notes=data.notes,
        created_by=current_user.id,
    )

    # Generate keys for WireGuard
    if data.tunnel_type == "wireguard":
        # Keys will be generated on the devices during deploy
        if not tunnel.device_a_port:
            tunnel.device_a_port = 13231
        if not tunnel.device_b_port:
            tunnel.device_b_port = 13231

    # Generate pre-shared key for IPSec
    if data.tunnel_type == "ipsec":
        if data.ipsec_secret:
            tunnel.ipsec_secret = encrypt_credential(data.ipsec_secret)
        else:
            generated_secret = secrets.token_urlsafe(32)
            tunnel.ipsec_secret = encrypt_credential(generated_secret)
        tunnel.ipsec_proposal = data.ipsec_proposal or "default"

    db.add(tunnel)
    await db.flush()
    await db.refresh(tunnel)

    await log_action(
        db, current_user, "CREATE", "vpn_tunnels",
        details=f"Criou túnel VPN '{tunnel.name}' ({tunnel.tunnel_type}) entre dispositivos {device_a.name} e {device_b.name}",
    )
    return await _enrich_tunnel(tunnel, db)


@router.get("/{tunnel_id}", response_model=VPNTunnelResponse)
async def get_tunnel(
    tunnel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VPNTunnel).where(VPNTunnel.id == tunnel_id))
    tunnel = result.scalar_one_or_none()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Túnel não encontrado")
    return await _enrich_tunnel(tunnel, db)


@router.patch("/{tunnel_id}", response_model=VPNTunnelResponse)
async def update_tunnel(
    tunnel_id: int,
    data: VPNTunnelUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VPNTunnel).where(VPNTunnel.id == tunnel_id))
    tunnel = result.scalar_one_or_none()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Túnel não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tunnel, key, value)

    db.add(tunnel)
    await db.flush()
    await db.refresh(tunnel)

    await log_action(db, current_user, "UPDATE", "vpn_tunnels", details=f"Atualizou túnel {tunnel.name}")
    return await _enrich_tunnel(tunnel, db)


@router.delete("/{tunnel_id}")
async def delete_tunnel(
    tunnel_id: int,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VPNTunnel).where(VPNTunnel.id == tunnel_id))
    tunnel = result.scalar_one_or_none()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Túnel não encontrado")

    await db.delete(tunnel)
    await log_action(db, current_user, "DELETE", "vpn_tunnels", details=f"Removeu túnel {tunnel.name}")
    return {"message": "Túnel removido com sucesso"}


@router.post("/{tunnel_id}/deploy")
async def deploy_tunnel(
    tunnel_id: int,
    deploy_opts: VPNTunnelDeploy,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
):
    """Deploy the VPN tunnel configuration to both MikroTik devices."""
    result = await db.execute(select(VPNTunnel).where(VPNTunnel.id == tunnel_id))
    tunnel = result.scalar_one_or_none()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Túnel não encontrado")

    dev_a_result = await db.execute(select(Device).where(Device.id == tunnel.device_a_id))
    dev_b_result = await db.execute(select(Device).where(Device.id == tunnel.device_b_id))
    device_a = dev_a_result.scalar_one_or_none()
    device_b = dev_b_result.scalar_one_or_none()

    if not device_a or not device_b:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    client_a = RouterOSClient(device_a)
    client_b = RouterOSClient(device_b)

    deploy_results = {"device_a": [], "device_b": [], "errors": []}

    try:
        if tunnel.tunnel_type == "wireguard":
            await _deploy_wireguard(tunnel, device_a, device_b, client_a, client_b, deploy_opts, deploy_results, db)
        elif tunnel.tunnel_type == "ipsec":
            await _deploy_ipsec(tunnel, device_a, device_b, client_a, client_b, deploy_opts, deploy_results)
        elif tunnel.tunnel_type in ("gre", "ipip", "eoip"):
            await _deploy_simple_tunnel(tunnel, device_a, device_b, client_a, client_b, deploy_opts, deploy_results)
        else:
            raise HTTPException(status_code=400, detail=f"Tipo de túnel '{tunnel.tunnel_type}' não suportado")

        if not deploy_results["errors"]:
            tunnel.status = "deployed"
        else:
            tunnel.status = "error"

        db.add(tunnel)

        await log_action(
            db, current_user, "DEPLOY", "vpn_tunnels",
            details=f"Deploy do túnel '{tunnel.name}' ({tunnel.tunnel_type}) - Status: {tunnel.status}",
        )
    except Exception as e:
        tunnel.status = "error"
        db.add(tunnel)
        deploy_results["errors"].append(str(e))

    return deploy_results


@router.post("/{tunnel_id}/status")
async def check_tunnel_status(
    tunnel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the status of a deployed VPN tunnel on both devices."""
    result = await db.execute(select(VPNTunnel).where(VPNTunnel.id == tunnel_id))
    tunnel = result.scalar_one_or_none()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Túnel não encontrado")

    dev_a = await db.execute(select(Device).where(Device.id == tunnel.device_a_id))
    dev_b = await db.execute(select(Device).where(Device.id == tunnel.device_b_id))
    device_a = dev_a.scalar_one_or_none()
    device_b = dev_b.scalar_one_or_none()

    status_info = {"device_a": None, "device_b": None}

    if device_a:
        client_a = RouterOSClient(device_a)
        if tunnel.tunnel_type == "wireguard":
            res = await client_a.get("interface/wireguard/peers")
            status_info["device_a"] = res.get("data") if res["success"] else {"error": res.get("error")}
        elif tunnel.tunnel_type == "ipsec":
            res = await client_a.get("ip/ipsec/active-peers")
            status_info["device_a"] = res.get("data") if res["success"] else {"error": res.get("error")}

    if device_b:
        client_b = RouterOSClient(device_b)
        if tunnel.tunnel_type == "wireguard":
            res = await client_b.get("interface/wireguard/peers")
            status_info["device_b"] = res.get("data") if res["success"] else {"error": res.get("error")}
        elif tunnel.tunnel_type == "ipsec":
            res = await client_b.get("ip/ipsec/active-peers")
            status_info["device_b"] = res.get("data") if res["success"] else {"error": res.get("error")}

    return status_info


async def _deploy_wireguard(tunnel, device_a, device_b, client_a, client_b, opts, results, db):
    """Deploy WireGuard tunnel between two devices."""
    iface_name = f"wg-{tunnel.name}"[:15]

    # Step 1: Create WireGuard interface on Device A
    res_a = await client_a.create("interface/wireguard", {
        "name": iface_name,
        "listen-port": str(tunnel.device_a_port or 13231),
        "comment": f"VPN Tunnel: {tunnel.name}",
    })
    results["device_a"].append({"action": "create_interface", "result": res_a})
    if not res_a["success"]:
        results["errors"].append(f"Device A - create interface: {res_a.get('error')}")
        return

    # Step 2: Create WireGuard interface on Device B
    res_b = await client_b.create("interface/wireguard", {
        "name": iface_name,
        "listen-port": str(tunnel.device_b_port or 13231),
        "comment": f"VPN Tunnel: {tunnel.name}",
    })
    results["device_b"].append({"action": "create_interface", "result": res_b})
    if not res_b["success"]:
        results["errors"].append(f"Device B - create interface: {res_b.get('error')}")
        return

    # Step 3: Fetch public keys from both devices
    wg_a = await client_a.get("interface/wireguard", {"name": iface_name})
    wg_b = await client_b.get("interface/wireguard", {"name": iface_name})

    if wg_a["success"] and wg_a["data"]:
        wg_data_a = wg_a["data"][0] if isinstance(wg_a["data"], list) else wg_a["data"]
        pub_key_a = wg_data_a.get("public-key", "")
        tunnel.device_a_public_key = pub_key_a
    else:
        results["errors"].append("Device A - failed to get public key")
        return

    if wg_b["success"] and wg_b["data"]:
        wg_data_b = wg_b["data"][0] if isinstance(wg_b["data"], list) else wg_b["data"]
        pub_key_b = wg_data_b.get("public-key", "")
        tunnel.device_b_public_key = pub_key_b
    else:
        results["errors"].append("Device B - failed to get public key")
        return

    # Step 4: Add peer on Device A (pointing to Device B)
    peer_a = await client_a.create("interface/wireguard/peers", {
        "interface": iface_name,
        "public-key": pub_key_b,
        "endpoint-address": tunnel.device_b_endpoint,
        "endpoint-port": str(tunnel.device_b_port or 13231),
        "allowed-address": "0.0.0.0/0",
        "persistent-keepalive": "25",
        "comment": f"Peer: {device_b.name}",
    })
    results["device_a"].append({"action": "add_peer", "result": peer_a})
    if not peer_a["success"]:
        results["errors"].append(f"Device A - add peer: {peer_a.get('error')}")

    # Step 5: Add peer on Device B (pointing to Device A)
    peer_b = await client_b.create("interface/wireguard/peers", {
        "interface": iface_name,
        "public-key": pub_key_a,
        "endpoint-address": tunnel.device_a_endpoint,
        "endpoint-port": str(tunnel.device_a_port or 13231),
        "allowed-address": "0.0.0.0/0",
        "persistent-keepalive": "25",
        "comment": f"Peer: {device_a.name}",
    })
    results["device_b"].append({"action": "add_peer", "result": peer_b})
    if not peer_b["success"]:
        results["errors"].append(f"Device B - add peer: {peer_b.get('error')}")

    # Step 6: Add tunnel IPs
    if tunnel.device_a_tunnel_ip:
        ip_a = await client_a.create("ip/address", {
            "address": tunnel.device_a_tunnel_ip,
            "interface": iface_name,
            "comment": f"VPN Tunnel: {tunnel.name}",
        })
        results["device_a"].append({"action": "add_ip", "result": ip_a})
        if not ip_a["success"]:
            results["errors"].append(f"Device A - add IP: {ip_a.get('error')}")

    if tunnel.device_b_tunnel_ip:
        ip_b = await client_b.create("ip/address", {
            "address": tunnel.device_b_tunnel_ip,
            "interface": iface_name,
            "comment": f"VPN Tunnel: {tunnel.name}",
        })
        results["device_b"].append({"action": "add_ip", "result": ip_b})
        if not ip_b["success"]:
            results["errors"].append(f"Device B - add IP: {ip_b.get('error')}")

    # Step 7: Add firewall rules to allow WireGuard traffic
    if opts.add_firewall_rules:
        for client, port, dev_name in [
            (client_a, tunnel.device_a_port or 13231, "device_a"),
            (client_b, tunnel.device_b_port or 13231, "device_b"),
        ]:
            fw = await client.create("ip/firewall/filter", {
                "chain": "input",
                "protocol": "udp",
                "dst-port": str(port),
                "action": "accept",
                "comment": f"WireGuard - {tunnel.name}",
                "place-before": "0",
            })
            results[dev_name].append({"action": "add_firewall_rule", "result": fw})

    # Step 8: Add routes if requested
    if opts.add_routes:
        if opts.routes_device_a and tunnel.device_b_tunnel_ip:
            gw = tunnel.device_b_tunnel_ip.split("/")[0]
            for network in opts.routes_device_a.split(","):
                route = await client_a.create("ip/route", {
                    "dst-address": network.strip(),
                    "gateway": gw,
                    "comment": f"VPN Route: {tunnel.name}",
                })
                results["device_a"].append({"action": "add_route", "result": route})

        if opts.routes_device_b and tunnel.device_a_tunnel_ip:
            gw = tunnel.device_a_tunnel_ip.split("/")[0]
            for network in opts.routes_device_b.split(","):
                route = await client_b.create("ip/route", {
                    "dst-address": network.strip(),
                    "gateway": gw,
                    "comment": f"VPN Route: {tunnel.name}",
                })
                results["device_b"].append({"action": "add_route", "result": route})

    db.add(tunnel)


async def _deploy_ipsec(tunnel, device_a, device_b, client_a, client_b, opts, results):
    """Deploy IPSec site-to-site tunnel between two devices."""
    secret = decrypt_credential(tunnel.ipsec_secret) if tunnel.ipsec_secret else "auto-generated"
    profile_name = f"ipsec-{tunnel.name}"[:20]

    for client, endpoint, tunnel_ip, other_endpoint, other_tunnel_ip, dev_name, other_dev_name in [
        (client_a, tunnel.device_a_endpoint, tunnel.device_a_tunnel_ip,
         tunnel.device_b_endpoint, tunnel.device_b_tunnel_ip, "device_a", "device_b"),
        (client_b, tunnel.device_b_endpoint, tunnel.device_b_tunnel_ip,
         tunnel.device_a_endpoint, tunnel.device_a_tunnel_ip, "device_b", "device_a"),
    ]:
        # Create IPSec profile
        profile = await client.create("ip/ipsec/profile", {
            "name": profile_name,
            "hash-algorithm": "sha256",
            "enc-algorithm": "aes-256",
            "dh-group": "modp2048",
            "comment": f"VPN: {tunnel.name}",
        })
        results[dev_name].append({"action": "create_profile", "result": profile})

        # Create peer
        peer = await client.create("ip/ipsec/peer", {
            "address": other_endpoint,
            "profile": profile_name,
            "exchange-mode": "ike2",
            "comment": f"VPN Peer: {tunnel.name}",
        })
        results[dev_name].append({"action": "create_peer", "result": peer})

        # Create identity
        identity = await client.create("ip/ipsec/identity", {
            "peer": f"*{peer.get('data', {}).get('.id', '').lstrip('*') if isinstance(peer.get('data'), dict) else ''}",
            "auth-method": "pre-shared-key",
            "secret": secret,
            "comment": f"VPN: {tunnel.name}",
        })
        results[dev_name].append({"action": "create_identity", "result": identity})

        # Create policy
        if tunnel_ip and other_tunnel_ip:
            src_net = tunnel_ip.split("/")[0] + "/32"
            dst_net = other_tunnel_ip.split("/")[0] + "/32"
            policy = await client.create("ip/ipsec/policy", {
                "src-address": src_net,
                "dst-address": dst_net,
                "action": "encrypt",
                "level": "require",
                "ipsec-protocols": "esp",
                "tunnel": "true",
                "sa-src-address": endpoint,
                "sa-dst-address": other_endpoint,
                "proposal": tunnel.ipsec_proposal or "default",
                "comment": f"VPN Policy: {tunnel.name}",
            })
            results[dev_name].append({"action": "create_policy", "result": policy})

        # Firewall rules
        if opts.add_firewall_rules:
            for proto_port in [("udp", "500"), ("udp", "4500"), ("ipsec-esp", None)]:
                fw_data = {
                    "chain": "input",
                    "protocol": proto_port[0],
                    "src-address": other_endpoint,
                    "action": "accept",
                    "comment": f"IPSec - {tunnel.name}",
                    "place-before": "0",
                }
                if proto_port[1]:
                    fw_data["dst-port"] = proto_port[1]
                fw = await client.create("ip/firewall/filter", fw_data)
                results[dev_name].append({"action": "add_firewall_rule", "result": fw})


async def _deploy_simple_tunnel(tunnel, device_a, device_b, client_a, client_b, opts, results):
    """Deploy GRE, IPIP, or EoIP tunnel between two devices."""
    iface_name = f"{tunnel.tunnel_type}-{tunnel.name}"[:15]
    path = f"interface/{tunnel.tunnel_type}"

    for client, local_addr, remote_addr, tunnel_ip, dev_name in [
        (client_a, tunnel.device_a_endpoint, tunnel.device_b_endpoint, tunnel.device_a_tunnel_ip, "device_a"),
        (client_b, tunnel.device_b_endpoint, tunnel.device_a_endpoint, tunnel.device_b_tunnel_ip, "device_b"),
    ]:
        iface_data = {
            "name": iface_name,
            "local-address": local_addr,
            "remote-address": remote_addr,
            "comment": f"VPN Tunnel: {tunnel.name}",
        }
        # EoIP requires tunnel-id
        if tunnel.tunnel_type == "eoip":
            iface_data["tunnel-id"] = str(tunnel.id)

        res = await client.create(path, iface_data)
        results[dev_name].append({"action": "create_interface", "result": res})

        if tunnel_ip:
            ip_res = await client.create("ip/address", {
                "address": tunnel_ip,
                "interface": iface_name,
                "comment": f"VPN Tunnel: {tunnel.name}",
            })
            results[dev_name].append({"action": "add_ip", "result": ip_res})

        if opts.add_firewall_rules:
            proto_map = {"gre": "gre", "ipip": "ipip", "eoip": "gre"}
            fw = await client.create("ip/firewall/filter", {
                "chain": "input",
                "protocol": proto_map.get(tunnel.tunnel_type, "gre"),
                "src-address": remote_addr,
                "action": "accept",
                "comment": f"{tunnel.tunnel_type.upper()} - {tunnel.name}",
                "place-before": "0",
            })
            results[dev_name].append({"action": "add_firewall_rule", "result": fw})
