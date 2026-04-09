import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import chokidar from 'chokidar';
import type { PrintJob, PrintNotification } from '@webgate/shared';
import { config } from '../config';
import { getDb } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Handles print redirection from RDP sessions.
 *
 * How it works:
 * 1. FreeRDP is configured with printer redirection (/printer flag)
 * 2. When a user prints in the RDP session, FreeRDP captures the print job
 *    and saves it as a PostScript/PDF file in the session's spool directory
 * 3. This handler watches the spool directory for new files
 * 4. If the file is PostScript, it converts it to PDF using GhostScript
 * 5. The PDF is made available for download via the REST API
 * 6. The client is notified via WebSocket that a print job is ready
 *
 * Alternative approach (for when FreeRDP printer redirection is limited):
 * - Install a virtual PostScript printer on the Windows server
 * - Configure it to output to a monitored spool directory
 * - The spool directory is shared via RDP drive redirection
 * - GhostScript converts PS → PDF
 */
export class PrintHandler {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private onJobReady?: (sessionId: string, notification: PrintNotification) => void;

  /**
   * Set callback for when a print job is ready for download.
   */
  setNotificationCallback(callback: (sessionId: string, notification: PrintNotification) => void): void {
    this.onJobReady = callback;
  }

  /**
   * Start watching print spool directory for a session.
   */
  startWatching(sessionId: string): void {
    const spoolDir = path.join(config.printSpoolDir, sessionId);
    fs.mkdirSync(spoolDir, { recursive: true });

    if (this.watchers.has(sessionId)) {
      return; // Already watching
    }

    const watcher = chokidar.watch(spoolDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
    });

    watcher.on('add', (filePath) => {
      this.handleNewPrintFile(sessionId, filePath);
    });

    watcher.on('error', (error) => {
      logger.error(`Print spool watcher error for session ${sessionId}: ${error}`);
    });

    this.watchers.set(sessionId, watcher);
    logger.info(`Watching print spool for session ${sessionId}: ${spoolDir}`);
  }

  /**
   * Stop watching print spool for a session.
   */
  stopWatching(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
      logger.info(`Stopped watching print spool for session ${sessionId}`);
    }
  }

  /**
   * Handle a new file in the print spool directory.
   */
  private async handleNewPrintFile(sessionId: string, filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const documentName = path.basename(filePath, ext);
    const jobId = uuidv4();

    logger.info(`New print file detected for session ${sessionId}: ${filePath}`);

    // Create print job record
    const db = getDb();
    db.prepare(`
      INSERT INTO print_jobs (id, session_id, document_name, status, created_at)
      VALUES (?, ?, ?, 'spooling', ?)
    `).run(jobId, sessionId, documentName, new Date().toISOString());

    try {
      let pdfPath: string;

      if (ext === '.pdf') {
        // Already PDF, just move it
        pdfPath = path.join(config.printSpoolDir, sessionId, `${jobId}.pdf`);
        fs.copyFileSync(filePath, pdfPath);
        fs.unlinkSync(filePath);
      } else if (ext === '.ps' || ext === '.prn' || ext === '.xps') {
        // Convert to PDF using GhostScript
        pdfPath = await this.convertToPdf(filePath, sessionId, jobId);
      } else {
        // Unsupported format - try to convert anyway
        pdfPath = await this.convertToPdf(filePath, sessionId, jobId);
      }

      const stats = fs.statSync(pdfPath);

      // Update job record
      db.prepare(`
        UPDATE print_jobs SET status = 'ready', pdf_path = ?, pdf_size = ? WHERE id = ?
      `).run(pdfPath, stats.size, jobId);

      logger.info(`Print job ready: ${jobId} (${documentName}, ${stats.size} bytes)`);

      // Notify client
      if (this.onJobReady) {
        this.onJobReady(sessionId, {
          jobId,
          documentName,
          status: 'ready',
          downloadUrl: `/api/print/download/${jobId}`,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Conversion failed';
      db.prepare('UPDATE print_jobs SET status = ?, error = ? WHERE id = ?')
        .run('error', errorMsg, jobId);
      logger.error(`Print job failed: ${jobId}: ${errorMsg}`);
    }
  }

  /**
   * Convert a PostScript/PRN file to PDF using GhostScript.
   */
  private convertToPdf(inputPath: string, sessionId: string, jobId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(config.printSpoolDir, sessionId, `${jobId}.pdf`);

      const db = getDb();
      db.prepare('UPDATE print_jobs SET status = ? WHERE id = ?').run('converting', jobId);

      const args = [
        '-dNOPAUSE',
        '-dBATCH',
        '-dSAFER',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dPDFSETTINGS=/printer',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ];

      logger.debug(`Running GhostScript: ${config.ghostscriptPath} ${args.join(' ')}`);

      const gs = spawn(config.ghostscriptPath, args);

      let stderr = '';
      gs.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gs.on('close', (code) => {
        // Clean up source file
        try {
          fs.unlinkSync(inputPath);
        } catch {
          // Ignore cleanup errors
        }

        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`GhostScript exited with code ${code}: ${stderr}`));
        }
      });

      gs.on('error', (err) => {
        reject(new Error(`Failed to run GhostScript: ${err.message}`));
      });
    });
  }

  /**
   * Get print job by ID.
   */
  getJob(jobId: string): PrintJob | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  /**
   * List print jobs for a session.
   */
  listJobs(sessionId: string): PrintJob[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM print_jobs WHERE session_id = ? ORDER BY created_at DESC'
    ).all(sessionId) as Record<string, unknown>[];
    return rows.map(row => this.rowToJob(row));
  }

  /**
   * Get the PDF file path for download.
   */
  getPdfPath(jobId: string): string | null {
    const job = this.getJob(jobId);
    if (!job || job.status !== 'ready' || !job.pdfPath) return null;

    if (!fs.existsSync(job.pdfPath)) return null;

    // Mark as downloaded
    const db = getDb();
    db.prepare('UPDATE print_jobs SET status = ? WHERE id = ?').run('downloaded', jobId);

    return job.pdfPath;
  }

  /**
   * Clean up old print jobs (called periodically).
   */
  cleanup(maxAgeMs: number = 86400000): void {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const db = getDb();
    const oldJobs = db.prepare(
      'SELECT * FROM print_jobs WHERE created_at < ?'
    ).all(cutoff) as Record<string, unknown>[];

    for (const row of oldJobs) {
      const job = this.rowToJob(row);
      if (job.pdfPath && fs.existsSync(job.pdfPath)) {
        fs.unlinkSync(job.pdfPath);
      }
    }

    db.prepare('DELETE FROM print_jobs WHERE created_at < ?').run(cutoff);
    logger.info(`Cleaned up ${oldJobs.length} old print jobs`);
  }

  /**
   * Shutdown: stop all watchers.
   */
  shutdown(): void {
    for (const [sessionId] of this.watchers) {
      this.stopWatching(sessionId);
    }
  }

  private rowToJob(row: Record<string, unknown>): PrintJob {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      documentName: row.document_name as string,
      status: row.status as PrintJob['status'],
      pdfPath: (row.pdf_path as string) || undefined,
      pdfSize: (row.pdf_size as number) || undefined,
      createdAt: row.created_at as string,
      error: (row.error as string) || undefined,
    };
  }
}

export const printHandler = new PrintHandler();
