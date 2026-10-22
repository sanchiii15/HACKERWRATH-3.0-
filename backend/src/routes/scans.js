import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { createScan, listScans, getScan, deleteScan } from '../controllers/scanController.js';

const router = Router();

router.post('/', upload.single('file'), createScan);
router.get('/', listScans);
router.get('/:id', getScan);
router.delete('/:id', deleteScan);

export default router;
