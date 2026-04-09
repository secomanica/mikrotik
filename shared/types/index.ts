// ============================================================
// WebGate RDP - Shared Type Definitions
// ============================================================

// --- Authentication ---

export interface LoginRequest {
  username: string;
  password: string;
  domain?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: UserInfo;
  error?: string;
}

export interface UserInfo {
  username: string;
  domain: string;
  displayName: string;
  groups: string[];
  isAdmin: boolean;
  sid?: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  username: string;
  domain: string;
  createdAt: string;
  lastActivity: string;
  rdpConnected: boolean;
  remoteAppId?: string;
}

// --- RemoteApp Publishing ---

export interface PublishedApp {
  id: string;
  name: string;
  displayName: string;
  executablePath: string;
  commandLineArgs?: string;
  iconBase64?: string;
  description?: string;
  allowedUsers: string[];
  allowedGroups: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAppRequest {
  name: string;
  displayName: string;
  executablePath: string;
  commandLineArgs?: string;
  description?: string;
  allowedUsers: string[];
  allowedGroups: string[];
}

// --- RDP Connection ---

export interface RdpConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  domain?: string;
  width: number;
  height: number;
  colorDepth: 15 | 16 | 24 | 32;
  remoteApp?: string;
  remoteAppArgs?: string;
  enablePrinting: boolean;
  enableDriveRedirection: boolean;
  drivePath?: string;
}

export type RdpConnectionState =
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface RdpSessionEvent {
  type: 'state_change' | 'resize' | 'error' | 'clipboard';
  sessionId: string;
  data: unknown;
  timestamp: string;
}

// --- WebSocket Messages ---

export type WsMessageType =
  | 'rdp:bitmap'
  | 'rdp:cursor'
  | 'rdp:state'
  | 'rdp:resize'
  | 'input:mouse'
  | 'input:keyboard'
  | 'input:clipboard'
  | 'print:ready'
  | 'print:progress'
  | 'file:progress'
  | 'session:event'
  | 'error';

export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
  timestamp: number;
}

// RDP bitmap data sent to client
export interface BitmapUpdate {
  x: number;
  y: number;
  width: number;
  height: number;
  bitsPerPixel: number;
  data: string; // base64-encoded bitmap data
  compressed: boolean;
}

// Mouse input from client
export interface MouseInput {
  x: number;
  y: number;
  button: 0 | 1 | 2 | 3; // none, left, middle, right
  pressed: boolean;
  flags: number;
}

// Keyboard input from client
export interface KeyboardInput {
  keyCode: number;
  scanCode: number;
  pressed: boolean;
  extended: boolean;
}

// --- File Transfer ---

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  created: string;
}

export interface FileTransferProgress {
  transferId: string;
  filename: string;
  direction: 'upload' | 'download';
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

// --- Print Jobs ---

export interface PrintJob {
  id: string;
  sessionId: string;
  documentName: string;
  status: 'spooling' | 'converting' | 'ready' | 'downloaded' | 'error';
  pdfPath?: string;
  pdfSize?: number;
  createdAt: string;
  error?: string;
}

export interface PrintNotification {
  jobId: string;
  documentName: string;
  status: PrintJob['status'];
  downloadUrl?: string;
}

// --- Server Configuration ---

export interface ServerConfig {
  host: string;
  port: number;
  tlsCert?: string;
  tlsKey?: string;
  rdpHost: string;
  rdpPort: number;
  sessionTimeout: number;
  maxSessions: number;
  printSpoolDir: string;
  fileTransferDir: string;
  ghostscriptPath: string;
  freerdpPath: string;
  dataDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// --- API Responses ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
