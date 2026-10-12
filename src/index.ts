import { app } from './app.js';
import { config } from './config.js';
import { startPolling } from './telegram/polling.js';

const server = app.listen(config.PORT, () => console.log(`3x-app listening on port ${config.PORT}`));
void startPolling().catch(() => console.error('Telegram approval polling failed to start'));
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () =>
    server.close(() => {
      process.exit(0);
    }),
  );
}
