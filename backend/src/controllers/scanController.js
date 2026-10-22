import fs from 'node:fs/promises';
import { Scan } from '../models/Scan.js';
import { HttpError } from '../middleware/errorHandler.js';
import { sha256File } from '../services/hash.js';
import { processScan } from '../services/pipeline.js';
import { engineFor } from '../services/detectors/index.js';

function mediaTypeOf(mimetype) {
  return mimetype.split('/')[0];
}

// A cached result is stale if it predates the forensic checks or used a different engine
// (e.g. the stub) for a modality that now has a real detector.
function isCurrent(scan) {
  if (!scan.forensics || !scan.risk) return false;
  const results = scan.results?.toObject?.() ?? scan.results ?? {};
  return Object.entries(results).every(([modality, r]) => !r?.engine || r.engine === engineFor(modality));
}

// POST /api/scans  (multipart field "file")
export async function createScan(req, res) {
  if (!req.file) throw new HttpError(400, 'No file uploaded (expected field "file")');
  const { path: filePath, originalname, mimetype, size } = req.file;

  const sha256 = await sha256File(filePath);

  // Same bytes already analysed with today's detectors: return the cached result instead of re-running.
  if (req.query.force !== 'true') {
    const existing = await Scan.findOne({ sha256, status: 'complete' }).sort({ createdAt: -1 });
    if (existing && isCurrent(existing)) {
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
      .select('-metadata.exif -results -forensics')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Scan.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}

// GET /api/scans/stats  — totals per media type and risk level, for the dashboard.
export async function getStats(_req, res) {
  const [byType, byLevel, recent] = await Promise.all([
    Scan.aggregate([
      {
        $group: {
          _id: '$mediaType',
          total: { $sum: 1 },
          complete: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } },
          flagged: { $sum: { $cond: [{ $in: ['$risk.level', ['high', 'critical']] }, 1, 0] } },
          avgScore: { $avg: '$confidence.score' },
        },
      },
    ]),
    Scan.aggregate([
      { $match: { status: 'complete' } },
      { $group: { _id: { mediaType: '$mediaType', level: '$risk.level' }, count: { $sum: 1 } } },
    ]),
    Scan.find({}).select('originalName mediaType status confidence risk.level risk.headline createdAt').sort({ createdAt: -1 }).limit(6),
  ]);

  const mediaTypes = {};
  for (const t of ['video', 'image', 'audio']) {
    const row = byType.find((r) => r._id === t);
    mediaTypes[t] = {
      total: row?.total ?? 0,
      complete: row?.complete ?? 0,
      flagged: row?.flagged ?? 0,
      avgScore: row?.avgScore ?? null,
      levels: { low: 0, medium: 0, high: 0, critical: 0 },
    };
  }
  for (const { _id, count } of byLevel) {
    if (mediaTypes[_id.mediaType] && _id.level) mediaTypes[_id.mediaType].levels[_id.level] = count;
  }

  res.json({ mediaTypes, recent });
}

// GET /api/scans/:id
export async function getScan(req, res) {
  const scan = await Scan.findById(req.params.id);
  if (!scan) throw new HttpError(404, 'Scan not found');
  res.json(scan);
}

const FEEDBACK_LABELS = ['authentic', 'manipulated', 'unsure'];

// POST /api/scans/:id/feedback  { label: 'authentic' | 'manipulated' | 'unsure', note? }
export async function submitFeedback(req, res) {
  const { label, note } = req.body ?? {};
  if (!FEEDBACK_LABELS.includes(label)) throw new HttpError(400, `label must be one of: ${FEEDBACK_LABELS.join(', ')}`);
  if (note != null && (typeof note !== 'string' || note.length > 1000)) throw new HttpError(400, 'note must be a string of at most 1000 characters');

  const scan = await Scan.findByIdAndUpdate(
    req.params.id,
    { $push: { feedback: { label, note: note?.trim() || undefined } } },
    { new: true, runValidators: true },
  ).select('feedback');
  if (!scan) throw new HttpError(404, 'Scan not found');
  res.status(201).json({ feedback: scan.feedback });
}

// GET /api/scans/:id/report  — downloadable JSON report of one scan.
export async function downloadReport(req, res) {
  const scan = await Scan.findById(req.params.id).lean();
  if (!scan) throw new HttpError(404, 'Scan not found');
  if (scan.status !== 'complete') throw new HttpError(409, 'Scan has not finished yet');

  const report = {
    generatedAt: new Date().toISOString(),
    disclaimer:
      'Automated screening result. It is not proof of authenticity or manipulation; verify through an independent, trusted channel.',
    file: { name: scan.originalName, type: scan.mimeType, size: scan.size, sha256: scan.sha256, scannedAt: scan.createdAt },
    verdict: scan.risk && {
      level: scan.risk.level,
      headline: scan.risk.headline,
      action: scan.risk.action,
      suspectedType: scan.risk.primaryType ?? null,
    },
    confidence: scan.confidence,
    riskMetrics: scan.risk?.metrics,
    manipulationTypes: scan.risk?.types,
    detectors: scan.results,
    forensics: scan.forensics,
    anomalies: scan.anomalies,
    metadata: scan.metadata,
    feedback: scan.feedback,
  };

  res.setHeader('Content-Disposition', `attachment; filename="deepfake-report-${scan._id}.json"`);
  res.type('application/json').send(JSON.stringify(report, null, 2));
}

// DELETE /api/scans/:id
export async function deleteScan(req, res) {
  const scan = await Scan.findByIdAndDelete(req.params.id);
  if (!scan) throw new HttpError(404, 'Scan not found');
  res.status(204).end();
}
