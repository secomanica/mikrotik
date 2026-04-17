import api from './api';
import type { Client, ClientCreate, ClientUpdate, VPNTunnel, VPNTunnelCreate, VPNTunnelDeploy } from '../types/client';

export const clientService = {
  async list(): Promise<Client[]> {
    const res = await api.get<Client[]>('/clients');
    return res.data;
  },

  async get(id: number): Promise<Client> {
    const res = await api.get<Client>(`/clients/${id}`);
    return res.data;
  },

  async create(data: ClientCreate): Promise<Client> {
    const res = await api.post<Client>('/clients', data);
    return res.data;
  },

  async update(id: number, data: ClientUpdate): Promise<Client> {
    const res = await api.patch<Client>(`/clients/${id}`, data);
    return res.data;
  },

  async remove(id: number) {
    await api.delete(`/clients/${id}`);
  },
};

export const vpnTunnelService = {
  async list(clientId?: number): Promise<VPNTunnel[]> {
    const params = clientId ? { client_id: clientId } : {};
    const res = await api.get<VPNTunnel[]>('/vpn-tunnels', { params });
    return res.data;
  },

  async get(id: number): Promise<VPNTunnel> {
    const res = await api.get<VPNTunnel>(`/vpn-tunnels/${id}`);
    return res.data;
  },

  async create(data: VPNTunnelCreate): Promise<VPNTunnel> {
    const res = await api.post<VPNTunnel>('/vpn-tunnels', data);
    return res.data;
  },

  async remove(id: number) {
    await api.delete(`/vpn-tunnels/${id}`);
  },

  async deploy(id: number, opts: VPNTunnelDeploy) {
    const res = await api.post(`/vpn-tunnels/${id}/deploy`, opts);
    return res.data;
  },

  async checkStatus(id: number) {
    const res = await api.post(`/vpn-tunnels/${id}/status`);
    return res.data;
  },
};
