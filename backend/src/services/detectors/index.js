import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/*
 * Detector client. The actual models (video, image, voice) are expected to run in a
 * separate inference service (e.g. Python/FastAPI) at DETECTOR_URL. Without one, a
 * deterministic stub is used so the full pipeline can be developed end to end.
 * Stub scores are NOT real predictions and are marked engine: "stub".
 */

export const detectorEngine = env.detectorUrl ? 'remote' : 'stub';

// Manipulation categories each detector may report, so results say *what kind*
// of manipulation is suspected rather than a bare "AI" label.
export const MANIPULATION_TYPES = {
  video: ['face_swap', 'lip_sync', 'ai_generated', 'edited'],
  image: ['ai_generated', 'face_swap', 'edited'],
  audio: ['voice_clone', 'tts', 'edited'],
};

async function remoteDetect(modality, filePath) {
  const form = new FormData();
  const blob = await fs.openAsBlob(filePath);
  form.append('file', blob, path.basename(filePath));

  const res = await fetch(`${env.detectorUrl}/detect/${modality}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(env.detectorTimeoutMs),
  });
  if (!res.ok) throw new Error(`Detector ${modality} returned ${res.status}`);
  const body = await res.json();
  if (typeof body.score !== 'number') throw new Error(`Detector ${modality} returned no score`);
  return { score: clamp(body.score), segments: body.segments ?? [], types: cleanTypes(modality, body.types) };
}

// Deterministic pseudo-score derived from file bytes, so variants of one file differ slightly.
async function stubDetect(modality, filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath, { start: 0, end: 1024 * 1024 });
  for await (const chunk of stream) hash.update(chunk);
  const digest = hash.digest('hex');
  const n = (i) => parseInt(digest.slice(i * 8, i * 8 + 8), 16) / 0xffffffff;
  const score = clamp(0.2 + n(0) * 0.6);
  const types = Object.fromEntries((MANIPULATION_TYPES[modality] ?? []).map((t, i) => [t, clamp(score * n(i + 1))]));
  return { score, segments: [], types };
}

// Keep only known categories with numeric probabilities.
function cleanTypes(modality, types) {
  if (!types || typeof types !== 'object') return undefined;
  const out = {};
  for (const t of MANIPULATION_TYPES[modality] ?? []) {
    if (typeof types[t] === 'number') out[t] = clamp(types[t]);
  }
  return Object.keys(out).length ? out : undefined;
}

function clamp(x) {
  return Math.min(1, Math.max(0, x));
}

export function detect(modality, filePath) {
  return detectorEngine === 'remote' ? remoteDetect(modality, filePath) : stubDetect(modality, filePath);
}
