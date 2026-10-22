import crypto from 'node:crypto';
import { Message } from '../models/Message.js';
import { HttpError } from '../middleware/errorHandler.js';
import { analyzeMessage } from '../services/messages/index.js';

const MAX_LENGTH = 5000;

// POST /api/messages  { text }
export async function createMessage(req, res) {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) throw new HttpError(400, 'Paste a message or link to check');
  if (text.length > MAX_LENGTH) throw new HttpError(400, `Messages can be up to ${MAX_LENGTH} characters`);

  const analysis = await analyzeMessage(text);
  const message = await Message.create({
    ...analysis,
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  });
  res.status(201).json(message);
}

// GET /api/messages?limit=20
export async function listMessages(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const items = await Message.find().select('text risk createdAt').sort({ createdAt: -1 }).limit(limit);
  res.json({ items });
}

// GET /api/messages/:id
export async function getMessage(req, res) {
  const message = await Message.findById(req.params.id);
  if (!message) throw new HttpError(404, 'Message check not found');
  res.json(message);
}

// DELETE /api/messages/:id
export async function deleteMessage(req, res) {
  const message = await Message.findByIdAndDelete(req.params.id);
  if (!message) throw new HttpError(404, 'Message check not found');
  res.status(204).end();
}
