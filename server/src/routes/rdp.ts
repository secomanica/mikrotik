import { Router } from 'express';
import type { RdpConnectionConfig } from '@webgate/shared';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { rdpManager } from '../rdp/connection-manager';
import { printHandler } from '../print/print-handler';
import { fileManager } from '../filetransfer/file-manager';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/rdp/connect
 * Start an RDP connection for the authenticated user.
 * Can connect to full desktop or a specific RemoteApp.
 */
router.post('/connect', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { sessionId, username, domain } = req.session!;
  const { width, height, colorDepth, appId } = req.body;

  // Check if already connected
  const existing = rdpManager.getSession(sessionId);
  if (existing) {
    res.json({
      success: true,
      data: { sessionId, state: 'already_connected' },
    });
    return;
  }

  try {
    const transferDir = fileManager.getDrivePath(username, domain);

    const rdpConfig: RdpConnectionConfig = {
      host: config.rdpHost,
      port: config.rdpPort,
      username,
      password: req.body.password, // Password sent for RDP auth
      domain: domain !== 'LOCAL' ? domain : undefined,
      width: width || 1920,
      height: height || 1080,
      colorDepth: colorDepth || 16,
      enablePrinting: true,
      enableDriveRedirection: true,
      drivePath: transferDir,
    };

    // If connecting to a specific RemoteApp
    if (appId) {
      const { appManager } = await import('../remoteapp/app-manager');
      const app = appManager.getById(appId);
      if (!app) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }
      rdpConfig.remoteApp = app.executablePath;
      rdpConfig.remoteAppArgs = app.commandLineArgs;
    }

    await rdpManager.connect(rdpConfig, sessionId);

    // Start watching for print jobs
    printHandler.startWatching(sessionId);

    logger.info(`RDP connection started for ${domain}\\${username} (session: ${sessionId})`);

    res.json({
      success: true,
      data: {
        sessionId,
        state: 'connecting',
        wsUrl: `/rdp?session=${sessionId}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect';
    logger.error(`RDP connection failed for ${domain}\\${username}: ${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/rdp/disconnect
 * Disconnect the current RDP session.
 */
router.post('/disconnect', requireAuth, (req: AuthenticatedRequest, res) => {
  const { sessionId } = req.session!;

  rdpManager.disconnect(sessionId);
  printHandler.stopWatching(sessionId);

  res.json({ success: true, message: 'Disconnected' });
});

/**
 * GET /api/rdp/status
 * Get the current RDP connection status.
 */
router.get('/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const { sessionId } = req.session!;
  const session = rdpManager.getSession(sessionId);

  res.json({
    success: true,
    data: {
      connected: !!session,
      state: session ? 'connected' : 'disconnected',
      activeSessions: rdpManager.getActiveSessionCount(),
      maxSessions: config.maxSessions,
    },
  });
});

export default router;
