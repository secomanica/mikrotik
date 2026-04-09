import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { printHandler } from '../print/print-handler';

const router = Router();

/**
 * GET /api/print/jobs
 * List print jobs for the current session.
 */
router.get('/jobs', requireAuth, (req: AuthenticatedRequest, res) => {
  const { sessionId } = req.session!;
  const jobs = printHandler.listJobs(sessionId);

  res.json({ success: true, data: jobs });
});

/**
 * GET /api/print/download/:id
 * Download a printed PDF document.
 */
router.get('/download/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const job = printHandler.getJob(id);

  if (!job) {
    res.status(404).json({ success: false, error: 'Print job not found' });
    return;
  }

  // Verify the job belongs to the user's session
  if (job.sessionId !== req.session!.sessionId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  const pdfPath = printHandler.getPdfPath(id);
  if (!pdfPath) {
    res.status(404).json({ success: false, error: 'PDF file not found or not ready' });
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${job.documentName}.pdf"`);
  res.download(pdfPath);
});

export default router;
