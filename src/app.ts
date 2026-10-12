import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { checkOrigin } from './auth/session.js';
import { api } from './api.js';
import { errorHandler } from './errors.js';
import { html, scriptHash } from './web.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        'script-src': [scriptHash, 'https://telegram.org'],
        'frame-ancestors': ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': config.production ? [] : null,
      },
    },
  }),
);
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.post(
  `${config.APP_BASE_PATH === '/' ? '' : config.APP_BASE_PATH}/api`,
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много запросов. Попробуйте через минуту.' },
  }),
  checkOrigin,
  express.json({ limit: '16kb' }),
  api,
);
app.get(config.APP_BASE_PATH, (_req, res) => res.type('html').send(html));
app.use(errorHandler);
