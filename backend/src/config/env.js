import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const env = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/deepfake-detector',
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 200) * 1024 * 1024,
  keepUploads: process.env.KEEP_UPLOADS === 'true',
  ffmpegPath: process.env.FFMPEG_PATH || null,
  ffprobePath: process.env.FFPROBE_PATH || null,
  detectorUrl: process.env.DETECTOR_URL ? process.env.DETECTOR_URL.replace(/\/$/, '') : null,
  detectorTimeoutMs: Number(process.env.DETECTOR_TIMEOUT_MS) || 60000,
  uploadDir: path.join(root, 'uploads'),
  tmpDir: path.join(root, 'tmp'),
};
