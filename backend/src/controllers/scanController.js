import fs from 'node:fs/promises';
import { Scan } from '../models/Scan.js';
import { HttpError } from '../middleware/errorHandler.js';
import { sha256File } from '../services/hash.js';
import { processScan } from '../services/pipeline.js';

function mediaTypeOf(mimetype) {
  return mimetype.split('/')[0];
}

// POST /api/scans  (multipart field "file")
export async function createScan(req, res) {
  if (!req.file) throw new HttpError(400, 'No file uploaded (expected field "file")');
  const { path: filePath, originalname, mimetype, size } = req.file;

  const sha256 = await sha256File(filePath);

  // Same bytes already analysed: return the cached result instead of re-running.
  if (req.query.force !== 'true') {
    const existing = await Scan.findOne({ sha256, status: 'complete' }).sort({ createdAt: -1 });
    if (existing) {
      await fs.rm(filePath, { force: true });
      return res.status(200).json({ cached: true, scan: existing });
    }
  }

  const scan = await Scan.create({
    originalName: originalname,
    mimeType: mimetype,
    size,
    sha256,
    mediaType: mediaTypeOf(mimetype),
    status: 'queued',
    stage: 'Queued',
  });

  // Fire and forget; the client polls GET /api/scans/:id for progress.
  processScan(scan._id, filePath).catch((err) => console.error('[pipeline]', err));

  res.status(202).json({ cached: false, scan });
}

// GET /api/scans?limit=20&page=1&status=complete
export async function listScans(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.mediaType) filter.mediaType = req.query.mediaType;

  const [items, total] = await Promise.all([
    Scan.find(filter)
      .select('-metadata.exif -results')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Scan.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}

// GET /api/scans/:id
export async function getScan(req, res) {
  const scan = await Scan.findById(req.params.id);
  if (!scan) throw new HttpError(404, 'Scan not found');
  res.json(scan);
}

// DELETE /api/scans/:id
export async function deleteScan(req, res) {
  const scan = await Scan.findByIdAndDelete(req.params.id);
  if (!scan) throw new HttpError(404, 'Scan not found');
  res.status(204).end();
}
