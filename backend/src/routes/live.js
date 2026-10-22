import express, { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { HttpError } from '../middleware/errorHandler.js';
import { scoreVoicePcm } from '../services/detectors/onnx.js';
import { hasModel } from '../services/detectors/models.js';

const router = Router();

const SAMPLE_RATE = 16000;
const MIN_SAMPLES = SAMPLE_RATE; // 1 s
const MAX_SAMPLES = SAMPLE_RATE * 6; // 6 s
const SPEECH_DB = -42; // 20 ms windows louder than this count as voice activity
const MIN_ACTIVE_SHARE = 0.25;

// A live session sends a chunk every ~2 s, so allow a steady stream per client.
const liveLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 600, message: 'Live check limit reached. Please wait a few minutes.' });

// Share of 20 ms windows with enough energy to be speech, plus overall loudness.
function voiceActivity(pcm) {
  const w = SAMPLE_RATE * 0.02;
  let active = 0;
  let windows = 0;
  let total = 0;
  for (let start = 0; start + w <= pcm.length; start += w) {
    let e = 0;
    for (let i = start; i < start + w; i++) e += pcm[i] * pcm[i];
    total += e;
    if (10 * Math.log10(e / w + 1e-12) > SPEECH_DB) active++;
    windows++;
  }
  return { activeShare: windows ? active / windows : 0, rmsDb: 10 * Math.log10(total / pcm.length + 1e-12) };
}

/*
 * POST /api/live/chunk  (body: raw 32-bit float PCM, 16 kHz mono, 1–6 s)
 * Scores one window of a live call with the voice model. Silent or noise-only windows are
 * reported as speech: false and not scored, so they can't push the meter around.
 * Nothing is stored: audio is scored in memory and discarded.
 */
router.post(
  '/chunk',
  liveLimit,
  express.raw({ type: 'application/octet-stream', limit: `${MAX_SAMPLES * 4 + 1024}b` }),
  async (req, res) => {
    if (!hasModel('voice')) throw new HttpError(503, 'The voice model is not installed on this server');
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length % 4 !== 0) throw new HttpError(400, 'Expected raw 32-bit float PCM');
    // Copy into an aligned buffer; the request buffer may not start on a 4-byte boundary.
    const pcm = new Float32Array(buf.length / 4);
    new Uint8Array(pcm.buffer).set(buf);
    if (pcm.length < MIN_SAMPLES || pcm.length > MAX_SAMPLES) throw new HttpError(400, 'Chunks must be 1–6 seconds of 16 kHz audio');

    const started = Date.now();
    const { activeShare, rmsDb } = voiceActivity(pcm);
    const speech = activeShare >= MIN_ACTIVE_SHARE;
    const fake = speech ? await scoreVoicePcm(pcm) : null;
    res.json({
      speech,
      fake,
      activeShare: Math.round(activeShare * 100) / 100,
      rmsDb: Math.round(rmsDb),
      ms: Date.now() - started,
    });
  },
);

export default router;
