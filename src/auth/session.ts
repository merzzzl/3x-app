import type { RequestHandler } from 'express';
import { validate } from '@tma.js/init-data-node';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';

declare global {
  namespace Express {
    interface Request {
      telegramUser: { id: string; email: string };
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!config.TELEGRAM_BOT_TOKEN) throw new AppError(503, 'Telegram-бот пока не настроен.');
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('tma ')) throw new AppError(401, 'Откройте приложение через Telegram.');
  try {
    const raw = header.slice(4);
    if (raw.length > 12000) throw new Error('Oversized initData');
    const params = new URLSearchParams(raw);
    if (new Set(params.keys()).size !== [...params.keys()].length) throw new Error('Duplicate fields');
    validate(raw, config.TELEGRAM_BOT_TOKEN, { expiresIn: 3600 });
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || authDate > Date.now() / 1000 + 30) throw new Error('Future auth date');
    const user = z
      .object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) })
      .parse(JSON.parse(params.get('user') ?? 'null'));
    const id = String(user.id);
    req.telegramUser = { id, email: `${id}@3x.local` };
  } catch {
    throw new AppError(
      401,
      'Авторизация Telegram истекла или недействительна. Закройте и снова откройте приложение.',
    );
  }
  next();
};

export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== config.APP_ORIGIN) {
    throw new AppError(403, 'Недопустимый источник запроса.');
  }
  next();
};
