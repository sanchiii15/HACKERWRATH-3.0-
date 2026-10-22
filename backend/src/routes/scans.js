import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';
import {
  createScan, listScans, getStats, getScan, deleteScan, submitFeedback, downloadReport,
} from '../controllers/scanController.js';

const router = Router();

const uploadLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.uploadsPer10Min,
  message: 'Upload limit reached. Please wait a few minutes before scanning more files.',
});
const feedbackLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 });

router.post('/', uploadLimit, upload.single('file'), createScan);
router.get('/', listScans);
router.get('/stats', getStats);
router.get('/:id', getScan);
router.get('/:id/report', downloadReport);
router.post('/:id/feedback', feedbackLimit, submitFeedback);
router.delete('/:id', deleteScan);

export default router;
