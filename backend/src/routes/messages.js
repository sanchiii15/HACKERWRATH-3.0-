import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { createMessage, listMessages, getMessage, deleteMessage } from '../controllers/messageController.js';

const router = Router();

// Each check can make outgoing requests (redirects, domain lookups), so keep it modest.
const checkLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: 'Too many message checks. Please wait a few minutes.',
});

router.post('/', checkLimit, createMessage);
router.get('/', listMessages);
router.get('/:id', getMessage);
router.delete('/:id', deleteMessage);

export default router;
