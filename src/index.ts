import { resolve } from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { accessRouter } from './access/routes.js';
import { startPolling } from './telegram/polling.js';
import { authRouter } from './auth/routes.js';
import { checkOrigin } from './auth/session.js';
import { profileRouter } from './profiles/routes.js';
import { errorHandler } from './errors.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", 'https://telegram.org'],
        'frame-ancestors': ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': config.production ? [] : null,
      },
    },
  }),
);
app.use('/api', express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много запросов. Попробуйте через минуту.' },
  }),
  checkOrigin,
);
app.use('/api/auth', authRouter);
app.use('/api/access', accessRouter);
app.use('/api/profiles', profileRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));
app.use(
  express.static(resolve(import.meta.dirname, '../public'), {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
  }),
);
app.use(errorHandler);

const server = app.listen(config.PORT, () => console.log(`3x-app API: http://localhost:${config.PORT}`));
void startPolling().catch(() => console.error('Telegram approval polling failed to start'));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () =>
    server.close(() => {
      process.exit(0);
    }),
  );
}
