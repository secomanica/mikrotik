import { v4 as uuidv4 } from 'uuid';
import type { PublishedApp, PublishAppRequest, UserInfo } from '@webgate/shared';
import { getDb } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Manages RemoteApp publishing.
 *
 * RemoteApp allows admins to publish specific Windows applications
 * that users can access through the browser without seeing the full desktop.
 *
 * Each app has:
 * - An executable path on the Windows server
 * - Optional command-line arguments
 * - Access control lists (users and/or groups)
 * - An icon for the web portal
 *
 * When a user launches a RemoteApp, we create an RDP session with
 * FreeRDP's /app flag, which opens only the specified application
 * using Windows RemoteApp (RAIL - Remote Application Integrated Locally).
 */
export class AppManager {
  /**
   * Publish a new application.
   */
  publish(request: PublishAppRequest): PublishedApp {
    const db = getDb();
    const now = new Date().toISOString();
    const id = uuidv4();

    const app: PublishedApp = {
      id,
      name: request.name,
      displayName: request.displayName,
      executablePath: request.executablePath,
      commandLineArgs: request.commandLineArgs ?? '',
      description: request.description ?? '',
      allowedUsers: request.allowedUsers,
      allowedGroups: request.allowedGroups,
      enabled: true,
      iconBase64: '',
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT INTO published_apps (id, name, display_name, executable_path, command_line_args,
        description, allowed_users, allowed_groups, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      app.id,
      app.name,
      app.displayName,
      app.executablePath,
      app.commandLineArgs,
      app.description,
      JSON.stringify(app.allowedUsers),
      JSON.stringify(app.allowedGroups),
      app.enabled ? 1 : 0,
      app.createdAt,
      app.updatedAt
    );

    logger.info(`Published app: ${app.displayName} (${app.executablePath})`);
    return app;
  }

  /**
   * Update an existing published application.
   */
  update(id: string, updates: Partial<PublishAppRequest>): PublishedApp | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE published_apps SET
        name = ?, display_name = ?, executable_path = ?, command_line_args = ?,
        description = ?, allowed_users = ?, allowed_groups = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.name,
      updated.displayName,
      updated.executablePath,
      updated.commandLineArgs ?? '',
      updated.description ?? '',
      JSON.stringify(updated.allowedUsers),
      JSON.stringify(updated.allowedGroups),
      updated.updatedAt,
      id
    );

    logger.info(`Updated app: ${updated.displayName}`);
    return updated;
  }

  /**
   * Delete a published application.
   */
  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM published_apps WHERE id = ?').run(id);
    if (result.changes > 0) {
      logger.info(`Deleted app: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Enable or disable an application.
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const db = getDb();
    const result = db.prepare('UPDATE published_apps SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /**
   * Get a published app by ID.
   */
  getById(id: string): PublishedApp | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM published_apps WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToApp(row) : null;
  }

  /**
   * List all published applications.
   */
  listAll(): PublishedApp[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM published_apps ORDER BY display_name').all() as Record<string, unknown>[];
    return rows.map(row => this.rowToApp(row));
  }

  /**
   * List applications available to a specific user (based on their username and groups).
   */
  listForUser(userInfo: { username: string; groups: string[] }): PublishedApp[] {
    const allApps = this.listAll().filter(app => app.enabled);

    return allApps.filter(app => {
      // If no restrictions, available to all
      if (app.allowedUsers.length === 0 && app.allowedGroups.length === 0) {
        return true;
      }

      // Check user allowlist
      if (app.allowedUsers.includes(userInfo.username)) {
        return true;
      }

      // Check group allowlist
      return app.allowedGroups.some(group => userInfo.groups.includes(group));
    });
  }

  /**
   * Update icon for an app (base64-encoded image).
   */
  setIcon(id: string, iconBase64: string): boolean {
    const db = getDb();
    const result = db.prepare('UPDATE published_apps SET icon_base64 = ?, updated_at = ? WHERE id = ?')
      .run(iconBase64, new Date().toISOString(), id);
    return result.changes > 0;
  }

  private rowToApp(row: Record<string, unknown>): PublishedApp {
    return {
      id: row.id as string,
      name: row.name as string,
      displayName: row.display_name as string,
      executablePath: row.executable_path as string,
      commandLineArgs: (row.command_line_args as string) || '',
      iconBase64: (row.icon_base64 as string) || '',
      description: (row.description as string) || '',
      allowedUsers: JSON.parse((row.allowed_users as string) || '[]'),
      allowedGroups: JSON.parse((row.allowed_groups as string) || '[]'),
      enabled: row.enabled === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const appManager = new AppManager();
