import path from 'path';
import dotenv from 'dotenv';
import type { ServerConfig } from '@webgate/shared';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

export const config: ServerConfig = {
  host: env('HOST', '0.0.0.0'),
  port: envInt('PORT', 8443),
  tlsCert: process.env.TLS_CERT,
  tlsKey: process.env.TLS_KEY,
  rdpHost: env('RDP_HOST', '127.0.0.1'),
  rdpPort: envInt('RDP_PORT', 3389),
  sessionTimeout: envInt('SESSION_TIMEOUT', 3600000),
  maxSessions: envInt('MAX_SESSIONS', 50),
  printSpoolDir: path.resolve(env('PRINT_SPOOL_DIR', './print-spool')),
  fileTransferDir: path.resolve(env('FILE_TRANSFER_DIR', './file-transfer')),
  ghostscriptPath: env('GHOSTSCRIPT_PATH', 'gswin64c'),
  freerdpPath: env('FREERDP_PATH', 'wfreerdp'),
  dataDir: path.resolve(env('DATA_DIR', './data')),
  logLevel: env('LOG_LEVEL', 'info') as ServerConfig['logLevel'],
};

export const jwtSecret = env('SESSION_SECRET', 'change-this-to-a-random-secret');
