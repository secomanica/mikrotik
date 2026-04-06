export interface Device {
  id: number;
  name: string;
  host: string;
  port: number;
  use_ssl: boolean;
  username: string;
  model: string | null;
  serial_number: string | null;
  ros_version: string | null;
  board_name: string | null;
  notes: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
}

export interface DeviceCreate {
  name: string;
  host: string;
  port: number;
  use_ssl: boolean;
  username: string;
  password: string;
  notes?: string;
}

export interface DeviceUpdate {
  name?: string;
  host?: string;
  port?: number;
  use_ssl?: boolean;
  username?: string;
  password?: string;
  notes?: string;
  is_active?: boolean;
}

export interface DeviceStatus {
  id: number;
  name: string;
  host: string;
  online: boolean;
  uptime: string | null;
  cpu_load: number | null;
  memory_used: number | null;
  memory_total: number | null;
  hdd_used: number | null;
  hdd_total: number | null;
  ros_version: string | null;
  board_name: string | null;
  architecture: string | null;
}
