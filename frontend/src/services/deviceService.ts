import api from './api';
import type { Device, DeviceCreate, DeviceUpdate, DeviceStatus } from '../types/device';

export const deviceService = {
  async list(): Promise<Device[]> {
    const res = await api.get<Device[]>('/devices');
    return res.data;
  },

  async get(id: number): Promise<Device> {
    const res = await api.get<Device>(`/devices/${id}`);
    return res.data;
  },

  async create(data: DeviceCreate): Promise<Device> {
    const res = await api.post<Device>('/devices', data);
    return res.data;
  },

  async update(id: number, data: DeviceUpdate): Promise<Device> {
    const res = await api.patch<Device>(`/devices/${id}`, data);
    return res.data;
  },

  async remove(id: number) {
    await api.delete(`/devices/${id}`);
  },

  async testConnection(id: number) {
    const res = await api.post(`/devices/${id}/test`);
    return res.data;
  },

  async getStatus(id: number): Promise<DeviceStatus> {
    const res = await api.get<DeviceStatus>(`/devices/${id}/status`);
    return res.data;
  },
};
