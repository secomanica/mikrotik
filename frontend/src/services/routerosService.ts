import api from './api';
import type { RouterOSResponse } from '../types/routeros';

export const rosService = {
  async get(deviceId: number, path: string, params?: Record<string, string>): Promise<RouterOSResponse> {
    const res = await api.get<RouterOSResponse>(`/devices/${deviceId}/ros/${path}`, { params });
    return res.data;
  },

  async create(deviceId: number, path: string, data: Record<string, any>): Promise<RouterOSResponse> {
    const res = await api.put<RouterOSResponse>(`/devices/${deviceId}/ros/${path}`, data);
    return res.data;
  },

  async update(deviceId: number, path: string, id: string, data: Record<string, any>): Promise<RouterOSResponse> {
    const res = await api.patch<RouterOSResponse>(`/devices/${deviceId}/ros/${path}/${id}`, data);
    return res.data;
  },

  async remove(deviceId: number, path: string, id: string): Promise<RouterOSResponse> {
    const res = await api.delete<RouterOSResponse>(`/devices/${deviceId}/ros/${path}/${id}`);
    return res.data;
  },

  async command(deviceId: number, path: string, data?: Record<string, any>): Promise<RouterOSResponse> {
    const res = await api.post<RouterOSResponse>(`/devices/${deviceId}/ros/${path}`, data);
    return res.data;
  },
};

export const monitorService = {
  async getResources(deviceId: number) {
    const res = await api.get(`/devices/${deviceId}/monitor/resources`);
    return res.data;
  },

  async getHealth(deviceId: number) {
    const res = await api.get(`/devices/${deviceId}/monitor/health`);
    return res.data;
  },

  async getInterfaces(deviceId: number) {
    const res = await api.get(`/devices/${deviceId}/monitor/interfaces`);
    return res.data;
  },

  async getOverview(deviceId: number) {
    const res = await api.get(`/devices/${deviceId}/monitor/overview`);
    return res.data;
  },

  async getLogs(deviceId: number) {
    const res = await api.get(`/devices/${deviceId}/monitor/logs`);
    return res.data;
  },
};

export const toolsService = {
  async ping(deviceId: number, data: { address: string; count?: number; size?: number }) {
    const res = await api.post(`/devices/${deviceId}/tools/ping`, data);
    return res.data;
  },

  async traceroute(deviceId: number, data: { address: string; count?: number }) {
    const res = await api.post(`/devices/${deviceId}/tools/traceroute`, data);
    return res.data;
  },

  async bandwidthTest(deviceId: number, data: { address: string; protocol?: string; direction?: string }) {
    const res = await api.post(`/devices/${deviceId}/tools/bandwidth-test`, data);
    return res.data;
  },

  async torch(deviceId: number, data: { interface: string; duration?: number }) {
    const res = await api.post(`/devices/${deviceId}/tools/torch`, data);
    return res.data;
  },
};
