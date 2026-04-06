import api from './api';
import type { LoginRequest, Token, User, UserCreate, UserUpdate } from '../types/auth';

export const authService = {
  async login(data: LoginRequest): Promise<Token> {
    const res = await api.post<Token>('/auth/login', data);
    localStorage.setItem('access_token', res.data.access_token);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    await api.patch('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  },
};

export const userService = {
  async list(): Promise<User[]> {
    const res = await api.get<User[]>('/users');
    return res.data;
  },

  async create(data: UserCreate): Promise<User> {
    const res = await api.post<User>('/users', data);
    return res.data;
  },

  async update(id: number, data: UserUpdate): Promise<User> {
    const res = await api.patch<User>(`/users/${id}`, data);
    return res.data;
  },

  async remove(id: number) {
    await api.delete(`/users/${id}`);
  },
};
