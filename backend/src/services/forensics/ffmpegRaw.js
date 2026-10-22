import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../../config/env.js';

const FFMPEG = env.ffmpegPath || 'ffmpeg';
const FFPROBE = env.ffprobePath || 'ffprobe';

// Runs a binary and collects stdout as a Buffer; optional `input` is piped to stdin.
function run(bin, args, { input, timeoutMs = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    const out = [];
    const err = [];
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`${path.basename(bin)} timed out`));
    }, timeoutMs);
    proc.stdout.on('data', (d) => out.push(d));
    proc.stderr.on('data', (d) => err.push(d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString();
      if (code !== 0) return reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.trim().slice(-300)}`));
      resolve({ stdout: Buffer.concat(out), stderr });
    });
    proc.stdin.on('error', () => {}); // ffmpeg may close stdin early; the exit code reports real failures
    proc.stdin.end(input ?? undefined);
  });
}

export const ffmpeg = (args, opts) => run(FFMPEG, ['-hide_banner', ...args], opts);
export const ffprobe = (args, opts) => run(FFPROBE, args, opts);

// Decodes one frame through a filter chain into raw pixels.
export async function decodeFrame(input, vf, pixFmt, { seek } = {}) {
  const args = ['-v', 'error'];
  if (seek) args.push('-ss', seek.toFixed(3));
  args.push('-i', input, '-frames:v', '1', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', pixFmt, 'pipe:1');
  return (await ffmpeg(args)).stdout;
}

// Colorizes an 8-bit grayscale buffer and returns a small PNG data URL for the UI.
export async function grayToPngDataUrl(gray, width, height, { colormap = 'inferno', maxWidth = 512 } = {}) {
  const { stdout } = await ffmpeg(
    [
      '-v', 'error',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${width}x${height}`, '-i', 'pipe:0',
      '-vf', `scale='min(${maxWidth},iw)':-2:flags=area,format=gbrp,pseudocolor=p=${colormap}`,
      '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1',
    ],
    { input: gray },
  );
  return `data:image/png;base64,${stdout.toString('base64')}`;
}

// Decodes up to `seconds` of audio as mono 32-bit float PCM.
export async function decodeAudio(input, { sampleRate, seconds = 60 }) {
  const { stdout } = await ffmpeg([
    '-v', 'error', '-i', input, '-t', String(seconds), '-map', '0:a:0',
    '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1',
  ]);
  return new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 4));
}
