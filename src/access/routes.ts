import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { accessStatus, requestAccess } from './service.js';
export const accessRouter = Router();
accessRouter.use(requireAuth);
accessRouter.get('/', async (req, res) => res.json(await accessStatus(req.telegramUser.id)));
accessRouter.post('/request', async (req, res) => res.json(await requestAccess(req.telegramUser.id)));
