import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

const ALLOWED = /^(video|image|audio)\//;

const storage = multer.diskStorage({
  destination: env.uploadDir,
  // Random name on disk; the client-supplied name is only stored as metadata.
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, `Unsupported file type: ${file.mimetype}`));
  },
});
