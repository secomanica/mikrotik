import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { fileManager } from '../filetransfer/file-manager';

const router = Router();

// Configure multer for file uploads (100MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

/**
 * GET /api/files/list
 * GET /api/files/list/:subPath(*)
 * List files in the user's transfer directory.
 */
router.get('/list', requireAuth, (req: AuthenticatedRequest, res) => {
  listFilesHandler(req, res, '');
});

router.get('/list/*', requireAuth, (req: AuthenticatedRequest, res) => {
  const subPath = req.params[0] || '';
  listFilesHandler(req, res, subPath);
});

function listFilesHandler(req: AuthenticatedRequest, res: any, subPath: string): void {
  try {
    const { username, domain } = req.session!;
    const files = fileManager.listFiles(username, domain, subPath);
    const usage = fileManager.getDiskUsage(username, domain);

    res.json({
      success: true,
      data: {
        path: subPath || '/',
        files,
        diskUsage: usage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list files';
    res.status(400).json({ success: false, error: message });
  }
}

/**
 * POST /api/files/upload
 * Upload a file to the user's transfer directory.
 * The file will be accessible as a mapped drive in the RDP session.
 */
router.post('/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  try {
    const { username, domain } = req.session!;
    const result = fileManager.saveUpload(
      username,
      domain,
      req.file.originalname,
      req.file.buffer
    );

    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/files/download/*
 * Download a file from the user's transfer directory.
 */
router.get('/download/*', requireAuth, (req: AuthenticatedRequest, res) => {
  const relativePath = req.params[0];

  if (!relativePath) {
    res.status(400).json({ success: false, error: 'File path is required' });
    return;
  }

  const { username, domain } = req.session!;
  const filePath = fileManager.getFilePath(username, domain, relativePath);

  if (!filePath) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  const filename = path.basename(filePath);
  res.download(filePath, filename);
});

/**
 * DELETE /api/files/*
 * Delete a file from the user's transfer directory.
 */
router.delete('/*', requireAuth, (req: AuthenticatedRequest, res) => {
  const relativePath = req.params[0];

  if (!relativePath) {
    res.status(400).json({ success: false, error: 'File path is required' });
    return;
  }

  const { username, domain } = req.session!;
  const deleted = fileManager.deleteFile(username, domain, relativePath);

  if (!deleted) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  res.json({ success: true, message: 'File deleted' });
});

/**
 * POST /api/files/mkdir
 * Create a directory in the user's transfer space.
 */
router.post('/mkdir', requireAuth, (req: AuthenticatedRequest, res) => {
  const { path: dirPath } = req.body;

  if (!dirPath) {
    res.status(400).json({ success: false, error: 'path is required' });
    return;
  }

  const { username, domain } = req.session!;

  try {
    fileManager.createDirectory(username, domain, dirPath);
    res.json({ success: true, message: 'Directory created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create directory';
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
