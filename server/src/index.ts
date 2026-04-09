import http from 'http';
import https from 'https';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import { config, jwtSecret } from './config';
import { initializeDatabase, closeDatabase } from './utils/db';
import { logger } from './utils/logger';
import { authenticator } from './auth/authenticator';
import { rdpManager } from './rdp/connection-manager';
import { sessionManager } from './sessions/session-manager';
import { printHandler } from './print/print-handler';
import authRoutes from './routes/auth';
import appRoutes from './routes/apps';
import fileRoutes from './routes/files';
import printRoutes from './routes/print';
import rdpRoutes from './routes/rdp';

// ============================================================
// WebGate RDP Server - Main Entry Point
// ============================================================

async function main(): Promise<void> {
  logger.info('Starting WebGate RDP Server...');

  // Initialize database
  initializeDatabase();

  // Create Express app
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  }));

  // Rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { success: false, error: 'Too many login attempts. Please try again later.' },
  });

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/apps', appRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/print', printRoutes);
  app.use('/api/rdp', rdpRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'running',
        version: '1.0.0',
        activeSessions: rdpManager.getActiveSessionCount(),
        uptime: process.uptime(),
      },
    });
  });

  // Serve frontend static files in production
  const clientBuildPath = `${__dirname}/../../client/dist`;
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    // SPA fallback: serve index.html for any non-API route
    app.get('*', (_req, res) => {
      res.sendFile(`${clientBuildPath}/index.html`);
    });
  }

  // Create HTTP/HTTPS server
  let server: http.Server | https.Server;

  if (config.tlsCert && config.tlsKey &&
      fs.existsSync(config.tlsCert) && fs.existsSync(config.tlsKey)) {
    server = https.createServer({
      cert: fs.readFileSync(config.tlsCert),
      key: fs.readFileSync(config.tlsKey),
    }, app);
    logger.info('HTTPS enabled');
  } else {
    server = http.createServer(app);
    logger.warn('Running in HTTP mode (no TLS certificates configured)');
  }

  // WebSocket server for RDP streaming
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname === '/rdp') {
      // Authenticate the WebSocket connection via query parameter
      const token = url.searchParams.get('token');
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const decoded = authenticator.verifyToken(token);
      if (!decoded) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        sessionManager.registerWebSocket(
          ws,
          decoded.sessionId as string,
          decoded.username as string,
          decoded.domain as string
        );
      });
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  });

  // Print notification callback → WebSocket
  printHandler.setNotificationCallback((sessionId, notification) => {
    sessionManager.sendToClient(sessionId, {
      type: 'print:ready',
      payload: notification,
      timestamp: Date.now(),
    });
  });

  // Periodic cleanup (every hour)
  setInterval(() => {
    printHandler.cleanup();
  }, 3600000);

  // Start server
  server.listen(config.port, config.host, () => {
    logger.info(`WebGate RDP Server listening on ${config.host}:${config.port}`);
    logger.info(`RDP target: ${config.rdpHost}:${config.rdpPort}`);
    logger.info(`Max sessions: ${config.maxSessions}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new connections
    server.close();

    // Disconnect all RDP sessions
    rdpManager.disconnectAll();

    // Close all WebSocket connections
    sessionManager.shutdown();

    // Stop print watchers
    printHandler.shutdown();

    // Close database
    closeDatabase();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
