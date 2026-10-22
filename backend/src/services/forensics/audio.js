import { ffprobe, decodeAudio } from './ffmpegRaw.js';
import { fft, hann, percentile, clamp01 } from './fft.js';

const FRAME = 4096;
const MAX_FRAMES = 400;

async function nativeSampleRate(input) {
  const { stdout } = await ffprobe([
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', input,
  ]);
  return Number(stdout.toString().trim()) || 44100;
}

/*
 * Audio signal checks for synthetic or cloned speech:
 * - effective bandwidth: many TTS / voice-clone models generate 16–24 kHz audio, which leaves
 *   a hard spectral cutoff well below the file's Nyquist frequency once it's saved at 44.1/48 kHz;
 * - digital silence: exact-zero gaps between phrases are typical of generated audio,
 *   while real microphones always record some background noise;
 * - clipping, as a general quality signal.
 */
export async function audioSignal(input) {
  const sampleRate = Math.min(48000, await nativeSampleRate(input));
  const pcm = await decodeAudio(input, { sampleRate, seconds: 60 });
  if (pcm.length < FRAME) return { sampleRate, tooShort: true, score: 0 };

  // Average power spectrum over non-overlapping Hann-windowed frames.
  const win = hann(FRAME);
  const power = new Float64Array(FRAME / 2);
  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  let frames = 0;
  const step = Math.max(FRAME, Math.floor(pcm.length / MAX_FRAMES));
  for (let start = 0; start + FRAME <= pcm.length && frames < MAX_FRAMES; start += step) {
    for (let i = 0; i < FRAME; i++) {
      re[i] = pcm[start + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < FRAME / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  const binHz = sampleRate / FRAME;
  const db = Array.from(power, (p) => 10 * Math.log10(p / frames + 1e-20));
  // Smooth over ~200 Hz so single noisy bins don't decide the cutoff.
  const span = Math.max(1, Math.round(200 / binHz));
  const smooth = db.map((_, k) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, k - span); j <= Math.min(db.length - 1, k + span); j++) {
      s += db[j];
      c++;
    }
    return s / c;
  });
  const startBin = Math.round(100 / binHz);
  const peakDb = Math.max(...smooth.slice(startBin));
  let cutoffBin = startBin;
  for (let k = smooth.length - 1; k >= startBin; k--) {
    if (smooth[k] > peakDb - 60) {
      cutoffBin = k;
      break;
    }
  }
  const bandwidthHz = cutoffBin * binHz;
  const nyquist = sampleRate / 2;
  // How steep the drop is just above the cutoff (a brick wall suggests resampling).
  const after = smooth[Math.min(smooth.length - 1, cutoffBin + Math.round(1000 / binHz))];
  const cutoffSharpnessDb = smooth[cutoffBin] - after;
  // Lossy codecs (AAC, MP3, Opus) low-pass at ~15–20 kHz, so only a cutoff at or below
  // ~12.5 kHz in a full-rate file points to audio generated at 16–24 kHz and upsampled.
  const bandwidthClass =
    nyquist - bandwidthHz <= 2500 ? 'full'
      : bandwidthHz >= 14000 ? 'codec'
        : nyquist >= 16000 && bandwidthHz <= 12500 && cutoffSharpnessDb > 10 ? 'upsampled'
          : 'rolloff';
  const bandLimited = bandwidthClass === 'upsampled';

  // 20 ms windows: digital silence, noise floor and clipping.
  const w = Math.round(sampleRate * 0.02);
  const rms = [];
  let silent = 0;
  let clipped = 0;
  for (let start = 0; start + w <= pcm.length; start += w) {
    let sum = 0;
    for (let i = start; i < start + w; i++) {
      sum += pcm[i] * pcm[i];
      if (Math.abs(pcm[i]) > 0.999) clipped++;
    }
    const r = Math.sqrt(sum / w);
    rms.push(r);
    if (r < 1e-5) silent++;
  }
  const digitalSilence = silent / rms.length;
  const noiseFloorDb = 20 * Math.log10(percentile(rms, 10) + 1e-9);
  const clippingRatio = clipped / pcm.length;

  // Narrowband (≈8 kHz cutoff) is also what phone and VoIP calls look like, so it scores lower.
  const bandScore = bandLimited ? (bandwidthHz < 9000 ? 0.45 : 0.6) : bandwidthClass === 'rolloff' ? 0.2 : 0.1;
  const silenceScore = clamp01((digitalSilence - 0.02) / 0.15);
  return {
    sampleRate,
    seconds: pcm.length / sampleRate,
    bandwidthHz: Math.round(bandwidthHz),
    cutoffSharpnessDb: Math.round(cutoffSharpnessDb),
    bandLimited,
    bandwidthClass,
    digitalSilence,
    noiseFloorDb: Math.round(noiseFloorDb),
    clippingRatio,
    score: Math.max(bandScore, silenceScore),
    bandScore,
    silenceScore,
  };
}
