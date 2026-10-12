import { config } from './config.js';
import { directFetch } from './http.js';

try {
  const response = await directFetch(`http://127.0.0.1:${config.PORT}${config.APP_BASE_PATH}`, {
    signal: AbortSignal.timeout(4000),
    redirect: 'error',
  });
  await response.body?.cancel();
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
