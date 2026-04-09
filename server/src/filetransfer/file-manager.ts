import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry, FileTransferProgress } from '@webgate/shared';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Manages bidirectional file transfer between the browser and RDP session.
 *
 * How it works:
 * 1. Each user gets a dedicated transfer directory on the server
 * 2. FreeRDP mounts this directory as a drive in the RDP session (/drive flag)
 * 3. Files placed in this directory by the browser appear as a drive in the RDP session
 * 4. Files saved to this drive by the user in the RDP session can be downloaded via browser
 *
 * This creates a virtual "shared folder" between the web client and the Windows session.
 *
 * Directory structure:
 *   file-transfer/
 *     {domain}_{username}/
 *       upload/       ← Browser uploads go here (visible as drive in RDP)
 *       download/     ← User saves files here from RDP (downloadable via browser)
 */
export class FileManager {
  /**
   * Get or create the transfer directory for a user.
   */
  getUserDir(username: string, domain: string): string {
    const userDir = path.join(config.fileTransferDir, `${domain}_${username}`);
    const uploadDir = path.join(userDir, 'upload');
    const downloadDir = path.join(userDir, 'download');

    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(downloadDir, { recursive: true });

    return userDir;
  }

  /**
   * Get the base transfer directory path (used for RDP drive mapping).
   */
  getDrivePath(username: string, domain: string): string {
    return this.getUserDir(username, domain);
  }

  /**
   * List files in a user's transfer directory.
   */
  listFiles(username: string, domain: string, subPath: string = ''): FileEntry[] {
    const userDir = this.getUserDir(username, domain);
    const targetDir = path.join(userDir, this.sanitizePath(subPath));

    // Prevent path traversal
    if (!targetDir.startsWith(userDir)) {
      throw new Error('Invalid path');
    }

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    return entries.map(entry => {
      const fullPath = path.join(targetDir, entry.name);
      const stats = fs.statSync(fullPath);
      const relativePath = path.relative(userDir, fullPath);

      return {
        name: entry.name,
        path: relativePath.replace(/\\/g, '/'),
        isDirectory: entry.isDirectory(),
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
      };
    });
  }

  /**
   * Save an uploaded file to the user's upload directory.
   */
  saveUpload(
    username: string,
    domain: string,
    filename: string,
    buffer: Buffer
  ): FileTransferProgress {
    const userDir = this.getUserDir(username, domain);
    const sanitizedName = this.sanitizeFilename(filename);
    const filePath = path.join(userDir, 'upload', sanitizedName);
    const transferId = uuidv4();

    fs.writeFileSync(filePath, buffer);

    logger.info(`File uploaded: ${sanitizedName} (${buffer.length} bytes) for ${domain}\\${username}`);

    return {
      transferId,
      filename: sanitizedName,
      direction: 'upload',
      bytesTransferred: buffer.length,
      totalBytes: buffer.length,
      percentage: 100,
      status: 'completed',
    };
  }

  /**
   * Get a file from the user's directory for download.
   * Returns the absolute file path or null if not found.
   */
  getFilePath(username: string, domain: string, relativePath: string): string | null {
    const userDir = this.getUserDir(username, domain);
    const sanitized = this.sanitizePath(relativePath);
    const fullPath = path.join(userDir, sanitized);

    // Prevent path traversal
    if (!fullPath.startsWith(userDir)) {
      logger.warn(`Path traversal attempt: ${relativePath} by ${domain}\\${username}`);
      return null;
    }

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      return null;
    }

    return fullPath;
  }

  /**
   * Delete a file from the user's transfer directory.
   */
  deleteFile(username: string, domain: string, relativePath: string): boolean {
    const userDir = this.getUserDir(username, domain);
    const sanitized = this.sanitizePath(relativePath);
    const fullPath = path.join(userDir, sanitized);

    // Prevent path traversal
    if (!fullPath.startsWith(userDir)) {
      return false;
    }

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      fs.rmdirSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    logger.info(`File deleted: ${relativePath} by ${domain}\\${username}`);
    return true;
  }

  /**
   * Create a directory in the user's transfer space.
   */
  createDirectory(username: string, domain: string, relativePath: string): boolean {
    const userDir = this.getUserDir(username, domain);
    const sanitized = this.sanitizePath(relativePath);
    const fullPath = path.join(userDir, sanitized);

    if (!fullPath.startsWith(userDir)) {
      return false;
    }

    fs.mkdirSync(fullPath, { recursive: true });
    return true;
  }

  /**
   * Get disk usage for a user's transfer directory.
   */
  getDiskUsage(username: string, domain: string): { totalBytes: number; fileCount: number } {
    const userDir = this.getUserDir(username, domain);
    let totalBytes = 0;
    let fileCount = 0;

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          totalBytes += fs.statSync(fullPath).size;
          fileCount++;
        }
      }
    };

    walk(userDir);
    return { totalBytes, fileCount };
  }

  /**
   * Clean up transfer files older than maxAge.
   */
  cleanup(maxAgeMs: number = 86400000): void {
    if (!fs.existsSync(config.fileTransferDir)) return;

    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs < cutoff) {
            fs.unlinkSync(fullPath);
            cleaned++;
          }
        }
      }
    };

    walk(config.fileTransferDir);
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old transfer files`);
    }
  }

  /**
   * Sanitize a filename to prevent directory traversal.
   */
  private sanitizeFilename(filename: string): string {
    return path.basename(filename).replace(/[<>:"|?*]/g, '_');
  }

  /**
   * Sanitize a relative path to prevent directory traversal.
   */
  private sanitizePath(relativePath: string): string {
    // Remove leading slashes and normalize
    const normalized = path.normalize(relativePath).replace(/^[/\\]+/, '');
    // Reject paths with '..'
    if (normalized.includes('..')) {
      throw new Error('Invalid path: directory traversal not allowed');
    }
    return normalized;
  }
}

export const fileManager = new FileManager();
