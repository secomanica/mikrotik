const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401) {
      this.token = null;
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  }

  // Auth
  async login(username: string, password: string, domain?: string) {
    return this.request<{ success: boolean; token?: string; user?: any; error?: string }>(
      '/auth/login',
      { method: 'POST', body: { username, password, domain } }
    );
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getSession() {
    return this.request<{ success: boolean; data: any }>('/auth/session');
  }

  // RDP
  async connectRdp(options: { width: number; height: number; password: string; appId?: string }) {
    return this.request<{ success: boolean; data: any }>('/rdp/connect', {
      method: 'POST',
      body: options,
    });
  }

  async disconnectRdp() {
    return this.request('/rdp/disconnect', { method: 'POST' });
  }

  async getRdpStatus() {
    return this.request<{ success: boolean; data: any }>('/rdp/status');
  }

  // Apps
  async listApps() {
    return this.request<{ success: boolean; data: any[] }>('/apps');
  }

  async createApp(app: any) {
    return this.request<{ success: boolean; data: any }>('/apps', {
      method: 'POST',
      body: app,
    });
  }

  async updateApp(id: string, updates: any) {
    return this.request<{ success: boolean; data: any }>(`/apps/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteApp(id: string) {
    return this.request(`/apps/${id}`, { method: 'DELETE' });
  }

  async toggleApp(id: string, enabled: boolean) {
    return this.request(`/apps/${id}/toggle`, { method: 'PATCH', body: { enabled } });
  }

  // Files
  async listFiles(subPath: string = '') {
    const path = subPath ? `/files/list/${subPath}` : '/files/list';
    return this.request<{ success: boolean; data: any }>(path);
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return response.json();
  }

  getFileDownloadUrl(filePath: string): string {
    return `${API_BASE}/files/download/${filePath}`;
  }

  async deleteFile(filePath: string) {
    return this.request(`/files/${filePath}`, { method: 'DELETE' });
  }

  async createDirectory(path: string) {
    return this.request('/files/mkdir', { method: 'POST', body: { path } });
  }

  // Print
  async listPrintJobs() {
    return this.request<{ success: boolean; data: any[] }>('/print/jobs');
  }

  getPrintDownloadUrl(jobId: string): string {
    return `${API_BASE}/print/download/${jobId}`;
  }
}

export const api = new ApiClient();
