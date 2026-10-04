import { Router } from 'express';
import { requireAuth } from './session.js';

export const authRouter = Router();
authRouter.get('/me', requireAuth, (req, res) => res.json(req.telegramUser));
