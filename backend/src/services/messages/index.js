import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { Scan } from '../../models/Scan.js';
import { sha256File } from '../hash.js';
import { processScan } from '../pipeline.js';
import { analyzeText } from './textSignals.js';
import { extractLinks, analyzeLink } from './links.js';
import { downloadToFile } from './safeFetch.js';

const MEDIA_LINK_MAX_BYTES = 50 * 1024 * 1024;
const EXT = { video: '.mp4', image: '.jpg', audio: '.mp3' };

const ACTIONS = {
  low: 'No common scam signs found. Still be careful with unexpected requests, and verify anything involving money.',
  medium: 'Some warning signs. Don’t click the link or reply until you’ve checked with the sender on a number you already have.',
  high: 'This looks like a scam. Don’t pay, click links, install apps or share codes. Verify with the person or company directly.',
  critical: 'Strong signs of a scam. Do not respond or click anything. If you already paid or shared details, call 1930 now.',
};

const levelFor = (score) => (score < 0.3 ? 'low' : score < 0.6 ? 'medium' : score < 0.85 ? 'high' : 'critical');

// Downloads a direct media link and runs it through the normal deepfake scan.
async function scanMediaLink(link) {
  if (link.contentLength && link.contentLength > MEDIA_LINK_MAX_BYTES) return { skipped: 'File is larger than 50 MB' };
  const file = path.join(env.uploadDir, `${Date.now()}-${crypto.randomUUID()}${EXT[link.mediaType]}`);
  try {
    const size = await downloadToFile(link.finalUrl, file, MEDIA_LINK_MAX_BYTES);
    const name = decodeURIComponent(new URL(link.finalUrl).pathname.split('/').pop() || `linked-${link.mediaType}`);
    const scan = await Scan.create({
      originalName: name.slice(0, 200),
      mimeType: link.contentType,
      size,
      sha256: await sha256File(file),
      mediaType: link.mediaType,
      status: 'queued',
      stage: 'Queued',
    });
    processScan(scan._id, file).catch((err) => console.error('[message media scan]', err));
    return { scanId: scan._id };
  } catch (err) {
    await fs.rm(file, { force: true });
    return { skipped: err.message };
  }
}

/*
 * Analyzes a pasted message: scam-signal rules on the text, plus checks on every link in it.
 * The two are combined so either a scammy text or a dangerous link can raise the risk.
 */
export async function analyzeMessage(text) {
  const found = extractLinks(text);
  const textResult = analyzeText(text, { exclude: found });
  const links = await Promise.all(found.map(analyzeLink));

  for (const link of links) {
    if (link.mediaType) link.mediaScan = await scanMediaLink(link);
  }

  const linkScore = Math.max(0, ...links.map((l) => l.score));
  const score = Math.min(1, 1 - (1 - textResult.score) * (1 - linkScore));
  const level = levelFor(score);

  const reasons = [
    ...textResult.signals.map((s) => ({ label: s.label, weight: s.weight })),
    ...links.flatMap((l) => l.flags.filter((f) => f.score >= 0.35).map((f) => ({ label: f.label, weight: f.score }))),
  ].sort((a, b) => b.weight - a.weight);
  const top = [...new Set(reasons.map((r) => r.label.replace(/ \(after redirect\)$/, '')))].slice(0, 3);

  const headline = level === 'low'
    ? (links.length ? 'No common scam signs in the text or links' : 'No common scam signs found')
    : level === 'medium' ? 'Suspicious message' : 'Likely scam message';

  return {
    text,
    textScore: textResult.score,
    signals: textResult.signals,
    links,
    risk: { level, score: Math.round(score * 1000) / 1000, headline, reasons: top, action: ACTIONS[level] },
  };
}
