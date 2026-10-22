import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { env } from '../config/env.js';

if (env.ffmpegPath) ffmpeg.setFfmpegPath(env.ffmpegPath);
if (env.ffprobePath) ffmpeg.setFfprobePath(env.ffprobePath);

function run(command) {
  return new Promise((resolve, reject) => {
    command.on('end', resolve).on('error', reject).run();
  });
}

function parseFps(rate) {
  if (!rate || rate === '0/0') return undefined;
  const [n, d] = rate.split('/').map(Number);
  return d ? Math.round((n / d) * 100) / 100 : n;
}

export function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const video = data.streams.find((s) => s.codec_type === 'video');
      const audio = data.streams.find((s) => s.codec_type === 'audio');
      const duration = Number(data.format.duration);
      resolve({
        container: data.format.format_name,
        duration: Number.isFinite(duration) ? duration : undefined,
        bitrate: Number(data.format.bit_rate) || undefined,
        width: video?.width,
        height: video?.height,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        fps: parseFps(video?.avg_frame_rate),
        hasVideo: Boolean(video),
        hasAudio: Boolean(audio),
      });
    });
  });
}

// 16 kHz mono WAV is the usual input format for speech/voice-clone models.
export async function extractAudio(input, outDir) {
  const out = path.join(outDir, 'audio.wav');
  await run(ffmpeg(input).noVideo().audioChannels(1).audioFrequency(16000).format('wav').output(out));
  return out;
}

// Samples frames evenly across the clip. Returns [{ path, time }].
export async function extractFrames(input, outDir, { duration, maxFrames = 24 } = {}) {
  const framesDir = path.join(outDir, 'frames');
  await fs.mkdir(framesDir, { recursive: true });
  const fps = duration ? Math.min(2, maxFrames / duration) : 1;
  await run(
    ffmpeg(input)
      .outputOptions(['-vf', `fps=${fps}`, '-frames:v', String(maxFrames), '-q:v', '2'])
      .output(path.join(framesDir, 'frame_%04d.jpg')),
  );
  const files = (await fs.readdir(framesDir)).filter((f) => f.endsWith('.jpg')).sort();
  return files.map((f, i) => ({ path: path.join(framesDir, f), time: i / fps }));
}

/*
 * Stress-test variants: simulate what social platforms / messengers do to uploads.
 * A detector whose score swings wildly across these is not trustworthy for this file,
 * and that spread widens the reported confidence band.
 */
const VARIANTS = {
  video: [
    { name: 'compressed', description: 'H.264 CRF 35 re-encode', ext: 'mp4',
      opts: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '35', '-c:a', 'aac', '-b:a', '64k'] },
    { name: 'downscaled', description: 'Resized to 480p', ext: 'mp4',
      opts: ['-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy'] },
    { name: 'messenger', description: '360p, 15 fps, low bitrate (chat app style)', ext: 'mp4',
      opts: ['-vf', 'scale=-2:360,fps=15', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '300k', '-c:a', 'aac', '-b:a', '32k'] },
  ],
  image: [
    { name: 'jpeg_q30', description: 'JPEG quality ~30', ext: 'jpg', opts: ['-q:v', '20'] },
    { name: 'downscaled', description: 'Resized to 50%', ext: 'png', opts: ['-vf', 'scale=iw/2:-2'] },
    { name: 'resize_recompress', description: '50% resize + JPEG ~50', ext: 'jpg', opts: ['-vf', 'scale=iw/2:-2', '-q:v', '10'] },
  ],
  audio: [
    { name: 'mp3_64k', description: 'MP3 64 kbps re-encode', ext: 'mp3', opts: ['-c:a', 'libmp3lame', '-b:a', '64k'] },
    { name: 'telephone', description: '8 kHz narrowband (phone call)', ext: 'wav', opts: ['-ar', '8000', '-ac', '1'] },
    { name: 'opus_24k', description: 'Opus 24 kbps (VoIP style)', ext: 'ogg', opts: ['-c:a', 'libopus', '-b:a', '24k'] },
  ],
};

export async function createStressVariants(input, mediaType, outDir) {
  const variants = [];
  for (const v of VARIANTS[mediaType] ?? []) {
    const out = path.join(outDir, `variant_${v.name}.${v.ext}`);
    try {
      const cmd = ffmpeg(input).outputOptions(v.opts).output(out);
      if (mediaType === 'image') cmd.frames(1);
      await run(cmd);
      variants.push({ name: v.name, description: v.description, path: out });
    } catch (err) {
      variants.push({ name: v.name, description: v.description, error: err.message });
    }
  }
  return variants;
}
