// Small numeric helpers for the forensic checks (no native dependencies).

// In-place iterative radix-2 FFT; length must be a power of two.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// 2D FFT of an n×n real image (row-major). Returns { re, im }.
export function fft2d(data, n) {
  const re = Float64Array.from(data);
  const im = new Float64Array(n * n);
  const rowRe = new Float64Array(n);
  const rowIm = new Float64Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const idx = pass === 0 ? a * n + b : b * n + a;
        rowRe[b] = re[idx];
        rowIm[b] = im[idx];
      }
      fft(rowRe, rowIm);
      for (let b = 0; b < n; b++) {
        const idx = pass === 0 ? a * n + b : b * n + a;
        re[idx] = rowRe[b];
        im[idx] = rowIm[b];
      }
    }
  }
  return { re, im };
}

// Naive 2D DCT-II, fine for the 32×32 perceptual hash.
export function dct2d(data, n) {
  const out = new Float64Array(n * n);
  const cos = new Float64Array(n * n);
  for (let k = 0; k < n; k++) for (let x = 0; x < n; x++) cos[k * n + x] = Math.cos(((2 * x + 1) * k * Math.PI) / (2 * n));
  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      let sum = 0;
      for (let y = 0; y < n; y++) {
        const cy = cos[u * n + y];
        for (let x = 0; x < n; x++) sum += data[y * n + x] * cy * cos[v * n + x];
      }
      out[u * n + v] = sum;
    }
  }
  return out;
}

export const hann = (n) => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
