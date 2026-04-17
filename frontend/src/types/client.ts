export interface Client {
  id: number;
  name: string;
  code: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  device_count: number | null;
}

export interface ClientCreate {
  name: string;
  code: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  notes?: string;
}

export interface ClientUpdate {
  name?: string;
  code?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  notes?: string;
  is_active?: boolean;
}

export interface VPNTunnel {
  id: number;
  name: string;
  client_id: number;
  tunnel_type: string;
  device_a_id: number;
  device_b_id: number;
  subnet: string | null;
  device_a_tunnel_ip: string | null;
  device_b_tunnel_ip: string | null;
  device_a_endpoint: string | null;
  device_b_endpoint: string | null;
  device_a_port: number | null;
  device_b_port: number | null;
  device_a_public_key: string | null;
  device_b_public_key: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  device_a_name: string | null;
  device_b_name: string | null;
  client_name: string | null;
}

export interface VPNTunnelCreate {
  name: string;
  client_id: number;
  tunnel_type: string;
  device_a_id: number;
  device_b_id: number;
  subnet?: string;
  device_a_tunnel_ip?: string;
  device_b_tunnel_ip?: string;
  device_a_endpoint?: string;
  device_b_endpoint?: string;
  device_a_port?: number;
  device_b_port?: number;
  ipsec_secret?: string;
  notes?: string;
}

export interface VPNTunnelDeploy {
  add_firewall_rules: boolean;
  add_routes: boolean;
  routes_device_a?: string;
  routes_device_b?: string;
}
