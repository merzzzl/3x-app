import { config } from '../config.js';
import { AppError } from '../errors.js';
import { errorDetails } from '../diagnostics.js';

function safeDescription(value: unknown) {
  if (typeof value !== 'string') return undefined;
  let text = value;
  for (const secret of [config.TELEGRAM_BOT_TOKEN, config.XUI_API_TOKEN]) {
    if (secret) text = text.replaceAll(secret, '[redacted]');
  }
  return text
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b\d{5,}:[A-Za-z0-9_-]+\b/g, '[token]')
    .replace(/[\r\n\x00-\x1f]/g, ' ')
    .slice(0, 300);
}

export async function telegram<T>(method: string, body: object): Promise<T> {
  if (!config.TELEGRAM_BOT_TOKEN) throw new AppError(503, 'Telegram-бот не настроен.');
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(method === 'getUpdates' ? 35000 : 15000),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      result: T;
      error_code?: number;
      description?: string;
    } | null;
    if (!response.ok || !data?.ok) {
      console.error('Telegram API rejected request:', {
        method,
        http: response.status,
        code: typeof data?.error_code === 'number' ? data.error_code : undefined,
        description: safeDescription(data?.description),
      });
      throw new AppError(502, 'Telegram отклонил запрос. Администратору нужно проверить журнал приложения.');
    }
    return data.result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Telegram connection failed:', { method, ...errorDetails(error) });
    throw new AppError(502, 'Telegram недоступен. Повторите попытку позже.');
  }
}
