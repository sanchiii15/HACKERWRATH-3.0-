import { ffmpeg, decodeFrame } from './ffmpegRaw.js';
import { fft2d, dct2d, hann, percentile, clamp01 } from './fft.js';

const MAX_ELA_SIDE = 2048;
const SPECTRUM_N = 256;
const even = (x) => Math.max(2, Math.round(x / 2) * 2);

/*
 * Error Level Analysis: re-save the image as JPEG and measure how much each pixel changes.
 * Regions pasted in from another source often re-compress differently from the rest,
 * so a few blocks with much higher error than the median is a (weak) editing signal.
 */
export async function errorLevelAnalysis(input, { width, height, lossless }) {
  const s = Math.min(1, MAX_ELA_SIDE / Math.max(width, height));
  const w = even(width * s);
  const h = even(height * s);

  const original = await decodeFrame(input, `scale=${w}:${h}:flags=area`, 'rgb24');
  const { stdout: jpeg } = await ffmpeg(
    ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', 'pipe:0',
      '-q:v', '3', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'],
    { input: original },
  );
  const { stdout: resaved } = await ffmpeg(
    ['-v', 'error', '-f', 'jpeg_pipe', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { input: jpeg },
  );

  const diff = new Uint8Array(w * h);
  let total = 0;
  for (let i = 0, p = 0; i < diff.length; i++, p += 3) {
    const d = Math.max(
      Math.abs(original[p] - resaved[p]),
      Math.abs(original[p + 1] - resaved[p + 1]),
      Math.abs(original[p + 2] - resaved[p + 2]),
    );
    diff[i] = d;
    total += d;
  }

  // Mean error per 16×16 block; outlier blocks suggest inconsistent compression history.
  const B = 16;
  const blocks = [];
  for (let by = 0; by + B <= h; by += B) {
    for (let bx = 0; bx + B <= w; bx += B) {
      let sum = 0;
      for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) sum += diff[y * w + x];
      blocks.push(sum / (B * B));
    }
  }
  const median = percentile(blocks, 50);
  const p99 = percentile(blocks, 99);
  const ratio = p99 / Math.max(median, 0.5);


  // Lossless sources have no prior JPEG grid, so ELA says little about them.
  // High-contrast edges and text also stand out in ELA, so the thresholds are deliberately lenient.
  const score = lossless ? clamp01((ratio - 4) / 8) * 0.5 : clamp01((ratio - 4) / 8);
  return {
    score,
    meanError: total / diff.length,
    blockMedian: median,
    blockP99: p99,
    outlierRatio: ratio,
    analysedSize: `${w}x${h}`,
    lossless,
  };
}

/*
 * Frequency spectrum: generators and upsamplers often leave periodic peaks in the
 * 2D Fourier spectrum that natural camera images don't have. We measure how far the
 * strongest high-frequency peak rises above the average at its radius.
 */
export async function frequencySpectrum(input, { seek } = {}) {
  const n = SPECTRUM_N;
  const gray = await decodeFrame(
    input,
    `scale=${n}:${n}:force_original_aspect_ratio=increase:flags=area,crop=${n}:${n}`,
    'gray',
    { seek },
  );
  let mean = 0;
  for (const v of gray) mean += v;
  mean /= gray.length;
  const win = hann(n);
  const data = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) data[y * n + x] = (gray[y * n + x] - mean) * win[y] * win[x];

  const { re, im } = fft2d(data, n);
  const half = n / 2;
  const logMag = new Float64Array(n * n); // fft-shifted so DC sits in the centre
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const src = ((y + half) % n) * n + ((x + half) % n);
      logMag[y * n + x] = Math.log1p(Math.hypot(re[src], im[src]));
    }
  }

  const maxR = Math.ceil(Math.SQRT2 * half);
  const radialSum = new Float64Array(maxR + 1);
  const radialCount = new Float64Array(maxR + 1);
  let hiEnergy = 0;
  let allEnergy = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.round(Math.hypot(x - half, y - half));
      radialSum[r] += logMag[y * n + x];
      radialCount[r]++;
      if (r > 0) {
        const e = Math.expm1(logMag[y * n + x]) ** 2;
        allEnergy += e;
        if (r > n / 4) hiEnergy += e;
      }
    }
  }

  let peak = 0;
  let peakCount = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - half;
      const dy = y - half;
      if (Math.abs(dx) <= 2 || Math.abs(dy) <= 2) continue; // skip the axis cross from image borders
      const r = Math.round(Math.hypot(dx, dy));
      if (r < 24 || r > half - 4) continue;
      const residual = logMag[y * n + x] - radialSum[r] / radialCount[r];
      if (residual > peak) peak = residual;
      if (residual > 2) peakCount++;
    }
  }

  return {
    // JPEG block grids and regular textures (fabric, screens) also create peaks, so start high.
    score: clamp01((peak - 2.2) / 2.5),
    peakStrength: peak,
    peakCount: peakCount / 2, // spectrum is symmetric, so each peak appears twice
    highFrequencyShare: allEnergy ? hiEnergy / allEnergy : 0,
  };
}

// 64-bit DCT perceptual hash: stays nearly identical after resizing and recompression.
export async function perceptualHash(input, { seek } = {}) {
  const gray = await decodeFrame(input, 'scale=32:32:flags=area', 'gray', { seek });
  const coeffs = dct2d(Float64Array.from(gray), 32);
  const low = [];
  for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) if (u || v) low.push(coeffs[u * 32 + v]);
  const median = percentile(low, 50);
  let bits = '';
  for (const c of low) bits += c > median ? '1' : '0';
  bits += '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingDistance(a, b) {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}
