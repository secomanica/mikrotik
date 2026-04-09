import { Router } from 'express';
import type { LoginRequest } from '@webgate/shared';
import { authenticator } from '../auth/authenticator';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { rdpManager } from '../rdp/connection-manager';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with Windows credentials.
 * On success, returns a JWT token and starts an RDP session.
 */
router.post('/login', async (req, res) => {
  const { username, password, domain } = req.body as LoginRequest;

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  const result = await authenticator.authenticate({ username, password, domain });

  if (!result.success) {
    res.status(401).json(result);
    return;
  }

  logger.info(`Login successful: ${domain || 'LOCAL'}\\${username}`);
  res.json(result);
});

/**
 * POST /api/auth/logout
 * End the current session and disconnect RDP.
 */
router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const { sessionId, username, domain } = req.session!;

  // Disconnect RDP session
  rdpManager.disconnect(sessionId);

  // Invalidate JWT/session
  authenticator.logout(sessionId);

  logger.info(`Logout: ${domain}\\${username}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/session
 * Get current session information.
 */
router.get('/session', requireAuth, (req: AuthenticatedRequest, res) => {
  const session = req.session!;
  const rdpSession = rdpManager.getSession(session.sessionId);

  res.json({
    success: true,
    data: {
      sessionId: session.sessionId,
      username: session.username,
      domain: session.domain,
      groups: session.groups,
      isAdmin: session.isAdmin,
      rdpConnected: !!rdpSession,
      rdpState: rdpSession ? 'connected' : 'disconnected',
    },
  });
});

export default router;
