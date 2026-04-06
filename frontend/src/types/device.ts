export interface Device {
  id: number;
  name: string;
  client_id: number | null;
  host: string;
  api_port: number;
  use_ssl: boolean;
  username: string;
  public_ip: string | null;
  ssh_port: number | null;
  winbox_port: number | null;
  model: string | null;
  serial_number: string | null;
  ros_version: string | null;
  board_name: string | null;
  identity: string | null;
  notes: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  client_name: string | null;
}

export interface DeviceCreate {
  name: string;
  client_id?: number | null;
  host: string;
  api_port: number;
  use_ssl: boolean;
  username: string;
  password: string;
  public_ip?: string;
  ssh_port?: number;
  winbox_port?: number;
  notes?: string;
}

export interface DeviceUpdate {
  name?: string;
  client_id?: number | null;
  host?: string;
  api_port?: number;
  use_ssl?: boolean;
  username?: string;
  password?: string;
  public_ip?: string;
  ssh_port?: number;
  winbox_port?: number;
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
