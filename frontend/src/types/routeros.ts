export interface RouterOSResponse {
  success: boolean;
  status_code: number;
  data: any;
  error: string | null;
}

export interface FieldMeta {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  required?: boolean;
  readOnly?: boolean;
  options?: string[];
  optionsFrom?: string;
  default?: any;
  description?: string;
}

export interface ResourceMeta {
  label: string;
  rosPath: string;
  fields: FieldMeta[];
  columns: string[];
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  orderable?: boolean;
  icon?: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  device_id: number | null;
  device_name: string | null;
  action: string;
  resource: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}
