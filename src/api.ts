import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { authRouter } from './auth/routes.js';
import { accessRouter } from './access/routes.js';
import { profileRouter } from './profiles/routes.js';

const call = z
  .object({
    method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
    path: z
      .string()
      .max(256)
      .regex(/^\/(?:auth\/me|access(?:\/request)?|profiles(?:\/[^/?#]+(?:\/(?:key|retry|name))?)?)$/),
    body: z.unknown().optional(),
  })
  .strict();

// These routes are internal; the only public API endpoint is POST <base>/api.
const routes = Router();
routes.use('/auth', authRouter);
routes.use('/access', accessRouter);
routes.use('/profiles', profileRouter);
routes.use((_req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));

export const api: RequestHandler = (req, res, next) => {
  const input = call.parse(req.body);
  req.method = input.method;
  req.url = input.path;
  req.body = input.body;
  routes(req, res, next);
};
