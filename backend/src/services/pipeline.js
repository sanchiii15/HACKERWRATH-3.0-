import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { Scan } from '../models/Scan.js';
import { inspectMetadata } from './metadata.js';
import { probe, extractAudio, extractFrames, createStressVariants } from './media.js';
import { detect, detectorEngine } from './detectors/index.js';
import { summarizeModality, computeConfidence } from './scoring.js';

const FRAME_ANOMALY_THRESHOLD = 0.7;

async function setStage(scan, stage) {
  scan.stage = stage;
  await scan.save();
}

// Runs the detector on the original plus every stress-test variant.
async function scoreVariants(modality, originalPath, variants) {
  const all = [{ name: 'original', description: 'As uploaded', path: originalPath }, ...variants];
  const scored = [];
  let segments = [];
  for (const v of all) {
    if (v.error) {
      scored.push({ name: v.name, description: v.description, error: v.error });
      continue;
    }
    try {
      const result = await detect(modality, v.path);
      scored.push({ name: v.name, description: v.description, score: result.score });
      if (v.name === 'original') segments = result.segments;
    } catch (err) {
      scored.push({ name: v.name, description: v.description, error: err.message });
    }
  }
  return { modality: summarizeModality(detectorEngine, scored), segments };
}

function toAnomalies(source, segments) {
  return segments
    .filter((s) => typeof s.start === 'number' && typeof s.score === 'number')
    .map((s) => ({ source, start: s.start, end: s.end ?? s.start, score: s.score, label: s.label }));
}

export async function processScan(scanId, filePath) {
  const started = Date.now();
  const scan = await Scan.findById(scanId);
  if (!scan) return;

  const workDir = path.join(env.tmpDir, String(scan._id));
  await fs.mkdir(workDir, { recursive: true });

  try {
    scan.status = 'processing';
    await setStage(scan, 'Reading metadata');

    const [meta, info] = await Promise.all([inspectMetadata(filePath), probe(filePath)]);
    const { hasVideo, hasAudio, ...probeInfo } = info;
    scan.metadata = { ...probeInfo, ...meta };

    const results = {};
    const anomalies = [];

    if (scan.mediaType === 'video' || scan.mediaType === 'image') {
      await setStage(scan, 'Stress-testing (compression, resizing, re-encoding)');
      const variants = await createStressVariants(filePath, scan.mediaType, workDir);

      await setStage(scan, `Running ${scan.mediaType} detector`);
      const { modality, segments } = await scoreVariants(scan.mediaType, filePath, variants);
      results[scan.mediaType] = modality;
      anomalies.push(...toAnomalies(scan.mediaType === 'video' ? 'video' : 'frame', segments));
    }

    if (scan.mediaType === 'video' && hasVideo) {
      await setStage(scan, 'Scanning sampled frames');
      const frames = await extractFrames(filePath, workDir, { duration: probeInfo.duration });
      const frameScores = [];
      const step = frames.length > 1 ? frames[1].time - frames[0].time : 1;
      for (const f of frames) {
        const { score } = await detect('image', f.path);
        frameScores.push({ name: `frame@${f.time.toFixed(1)}s`, score });
        if (score >= FRAME_ANOMALY_THRESHOLD) {
          anomalies.push({ source: 'frame', start: f.time, end: f.time + step, score, label: 'Frame flagged' });
        }
      }
      results.image = summarizeModality(detectorEngine, frameScores);
    }

    if (scan.mediaType === 'audio' || (scan.mediaType === 'video' && hasAudio)) {
      await setStage(scan, 'Running voice detector');
      const audioPath = scan.mediaType === 'audio' ? filePath : await extractAudio(filePath, workDir);
      const variants = await createStressVariants(audioPath, 'audio', workDir);
      const { modality, segments } = await scoreVariants('audio', audioPath, variants);
      results.audio = modality;
      anomalies.push(...toAnomalies('audio', segments));
    }

    scan.results = results;
    scan.anomalies = anomalies.sort((a, b) => a.start - b.start);
    scan.confidence = computeConfidence(results, scan.metadata);
    scan.status = 'complete';
    scan.stage = 'Done';
  } catch (err) {
    console.error(`[scan ${scan._id}] failed:`, err);
    scan.status = 'failed';
    scan.error = err.message;
  } finally {
    scan.processingMs = Date.now() - started;
    await scan.save().catch((e) => console.error('[scan] save failed', e));
    await fs.rm(workDir, { recursive: true, force: true });
    if (!env.keepUploads) await fs.rm(filePath, { force: true });
  }
}
