import { Router } from 'express';
import type { PublishAppRequest } from '@webgate/shared';
import { appManager } from '../remoteapp/app-manager';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/apps
 * List published apps available to the current user.
 */
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { username, groups, isAdmin } = req.session!;

  let apps;
  if (isAdmin) {
    // Admins see all apps
    apps = appManager.listAll();
  } else {
    apps = appManager.listForUser({ username, groups });
  }

  res.json({ success: true, data: apps });
});

/**
 * GET /api/apps/:id
 * Get a specific published app.
 */
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const app = appManager.getById(req.params.id);

  if (!app) {
    res.status(404).json({ success: false, error: 'App not found' });
    return;
  }

  // Check access if not admin
  if (!req.session!.isAdmin) {
    const { username, groups } = req.session!;
    const userApps = appManager.listForUser({ username, groups });
    if (!userApps.find(a => a.id === app.id)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
  }

  res.json({ success: true, data: app });
});

/**
 * POST /api/apps
 * Publish a new application (admin only).
 */
router.post('/', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const request = req.body as PublishAppRequest;

  if (!request.name || !request.displayName || !request.executablePath) {
    res.status(400).json({
      success: false,
      error: 'name, displayName, and executablePath are required',
    });
    return;
  }

  try {
    const app = appManager.publish(request);
    res.status(201).json({ success: true, data: app });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish app';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /api/apps/:id
 * Update a published application (admin only).
 */
router.put('/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const updates = req.body as Partial<PublishAppRequest>;

  const app = appManager.update(req.params.id, updates);
  if (!app) {
    res.status(404).json({ success: false, error: 'App not found' });
    return;
  }

  res.json({ success: true, data: app });
});

/**
 * DELETE /api/apps/:id
 * Delete a published application (admin only).
 */
router.delete('/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const deleted = appManager.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'App not found' });
    return;
  }

  res.json({ success: true, message: 'App deleted' });
});

/**
 * PATCH /api/apps/:id/toggle
 * Enable/disable an application (admin only).
 */
router.patch('/:id/toggle', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    res.status(400).json({ success: false, error: 'enabled (boolean) is required' });
    return;
  }

  const updated = appManager.setEnabled(req.params.id, enabled);
  if (!updated) {
    res.status(404).json({ success: false, error: 'App not found' });
    return;
  }

  res.json({ success: true, message: `App ${enabled ? 'enabled' : 'disabled'}` });
});

/**
 * POST /api/apps/:id/icon
 * Upload an icon for an application (admin only).
 */
router.post('/:id/icon', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { iconBase64 } = req.body;

  if (!iconBase64) {
    res.status(400).json({ success: false, error: 'iconBase64 is required' });
    return;
  }

  const updated = appManager.setIcon(req.params.id, iconBase64);
  if (!updated) {
    res.status(404).json({ success: false, error: 'App not found' });
    return;
  }

  res.json({ success: true, message: 'Icon updated' });
});

export default router;
