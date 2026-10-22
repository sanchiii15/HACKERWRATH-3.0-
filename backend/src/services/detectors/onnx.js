import os from 'node:os';
import ort from 'onnxruntime-node';
import { ffprobe, decodeFrame, decodeAudio } from '../forensics/ffmpegRaw.js';
import { MODELS, modelPath, hasModel } from './models.js';

/*
 * In-process inference with the pretrained ONNX detectors (no Python, CPU only).
 * FFmpeg does the resizing / audio resampling so preprocessing matches each model's config.
 */

// Several sessions share the CPU. ONNX Runtime's default (all cores, busy-spinning threads)
// makes them fight each other and runs ~7× slower, so cap threads and disable spinning.
const SESSION_OPTIONS = {
  graphOptimizationLevel: 'all',
  intraOpNumThreads: Math.max(2, Math.min(6, Math.floor(os.availableParallelism() / 2))),
  extra: { session: { intra_op: { allow_spinning: '0' } } },
};

const sessions = new Map();
function session(key) {
  if (!sessions.has(key)) sessions.set(key, ort.InferenceSession.create(modelPath(key), SESSION_OPTIONS));
  return sessions.get(key);
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

async function run(key, input, dims) {
  const s = await session(key);
  const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', input, dims) };
  // Some exports (e.g. the XLS-R voice model) also take an all-ones attention mask.
  if (s.inputNames.includes('attention_mask')) {
    const mask = MODELS[key].audio?.attentionMask === 'int32'
      ? new ort.Tensor('int32', new Int32Array(input.length).fill(1), dims)
      : new ort.Tensor('int64', new BigInt64Array(input.length).fill(1n), dims);
    feeds.attention_mask = mask;
  }
  const out = await s.run(feeds);
  return Array.from(out[s.outputNames[0]].data);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Mean of the highest quarter of values: a partly generated clip shouldn't be averaged away.
const topQuarterMean = (xs) => {
  const s = [...xs].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(xs.length / 4)));
  return s.reduce((a, b) => a + b, 0) / s.length;
};

// ---------------------------------------------------------------- images

function imageFilter({ image }) {
  if (image.crop) {
    // Shortest edge to N, then centre-crop (CLIPImageProcessor behaviour).
    const e = image.shortestEdge;
    return `scale='if(lt(iw,ih),${e},-2)':'if(lt(iw,ih),-2,${e})':flags=${image.resample},crop=${image.crop}:${image.crop}`;
  }
  return `scale=${image.width}:${image.height}:flags=${image.resample}`;
}

// Decodes one frame to a normalized NCHW float tensor for the given model.
async function imageTensor(key, input, seek) {
  const spec = MODELS[key];
  const w = spec.image.crop ?? spec.image.width;
  const h = spec.image.crop ?? spec.image.height;
  const rgb = await decodeFrame(input, imageFilter(spec), 'rgb24', { seek });
  if (rgb.length < w * h * 3) throw new Error(`Could not decode an image for ${key}`);
  const { mean, std } = spec.image;
  const data = new Float32Array(3 * w * h);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) data[c * w * h + i] = (rgb[i * 3 + c] / 255 - mean[c]) / std[c];
  }
  return { data, dims: [1, 3, h, w] };
}

/*
 * Scores one image (or one video frame) for AI generation:
 * - Community Forensics ViT → probability the image is AI-generated (main signal: it scored
 *   0% on every frame of a real webcam recording in testing);
 * - AI-vs-Deepfake-vs-Real ViT → its "artificial" class as a weak second opinion.
 * No face-swap probability is reported: the only face model available gave ~40% "deepfake"
 * to real and fake faces alike, so it carried no information.
 */
export async function detectImage(input, { seek } = {}) {
  const models = {};
  let aiGenerated;

  if (hasModel('aiImage')) {
    const t = await imageTensor('aiImage', input, seek);
    models.communityForensics = sigmoid((await run('aiImage', t.data, t.dims))[0]);
  }
  if (hasModel('imageTriage')) {
    const t = await imageTensor('imageTriage', input, seek);
    const p = softmax(await run('imageTriage', t.data, t.dims));
    models.aiVsDeepfakeVsReal = Object.fromEntries(MODELS.imageTriage.labels.map((l, i) => [l, p[i]]));
  }

  const cf = models.communityForensics;
  const tri = models.aiVsDeepfakeVsReal;
  if (cf != null && tri) aiGenerated = 0.8 * cf + 0.2 * tri.artificial;
  else aiGenerated = cf ?? tri?.artificial;

  const types = aiGenerated != null ? { ai_generated: aiGenerated } : {};
  return { score: aiGenerated ?? 0, types, models, segments: [] };
}

// ---------------------------------------------------------------- video

const VIDEO_SAMPLES = 8;

async function durationOf(input) {
  const { stdout } = await ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]);
  return Number(stdout.toString().trim()) || 0;
}

// Scores evenly spaced frames; the clip score is the mean of its most suspicious quarter of frames.
export async function detectVideo(input) {
  const duration = await durationOf(input);
  const times = duration > 0
    ? Array.from({ length: VIDEO_SAMPLES }, (_, i) => ((i + 0.5) * duration) / VIDEO_SAMPLES)
    : [0];
  const frames = [];
  for (const t of times) {
    try {
      frames.push({ t, ...(await detectImage(input, { seek: t })) });
    } catch {
      // past the last decodable frame; skip
    }
  }
  if (!frames.length) throw new Error('No decodable frames for the video detector');

  const step = duration / VIDEO_SAMPLES || 1;
  const score = topQuarterMean(frames.map((f) => f.score));
  return {
    score,
    types: { ai_generated: score },
    segments: frames
      .filter((f) => f.score >= 0.7)
      .map((f) => ({ start: Math.max(0, f.t - step / 2), end: f.t + step / 2, score: f.score, label: 'Detector flagged frame' })),
  };
}

// ---------------------------------------------------------------- audio

const CHUNK_SECONDS = 4;
const MAX_CHUNKS = 15;

/*
 * Voice anti-spoofing: 16 kHz mono audio in 4 s chunks, each normalized to zero mean /
 * unit variance (Wav2Vec2FeatureExtractor). The score is the median P(fake) across chunks,
 * so a few odd chunks (music, noise-suppressed laptop audio) can't decide the result alone.
 */
export async function detectAudio(input) {
  const { sampleRate } = MODELS.voice.audio;
  const pcm = await decodeAudio(input, { sampleRate, seconds: CHUNK_SECONDS * MAX_CHUNKS });
  if (pcm.length < sampleRate) throw new Error('Audio shorter than 1 second');

  const size = CHUNK_SECONDS * sampleRate;
  const chunks = [];
  for (let start = 0; start < pcm.length && chunks.length < MAX_CHUNKS; start += size) {
    const slice = pcm.subarray(start, Math.min(pcm.length, start + size));
    if (slice.length < sampleRate) break; // ignore a trailing fragment under 1 s
    let mean = 0;
    for (const v of slice) mean += v;
    mean /= slice.length;
    let variance = 0;
    for (const v of slice) variance += (v - mean) ** 2;
    const sd = Math.sqrt(variance / slice.length + 1e-7);
    const data = Float32Array.from(slice, (v) => (v - mean) / sd);
    const [, fake] = softmax(await run('voice', data, [1, data.length]));
    chunks.push({ start: start / sampleRate, end: (start + slice.length) / sampleRate, fake });
  }

  const score = median(chunks.map((c) => c.fake));
  return {
    score,
    types: { synthetic_voice: score },
    segments: chunks
      .filter((c) => c.fake >= 0.7)
      .map((c) => ({ start: c.start, end: c.end, score: c.fake, label: 'Synthetic voice detected' })),
  };
}

// Which modalities the downloaded models can cover.
export function localCapabilities() {
  const image = hasModel('aiImage') || hasModel('imageTriage');
  return { image, video: image, audio: hasModel('voice') };
}
