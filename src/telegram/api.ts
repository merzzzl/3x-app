import { config } from '../config.js';
import { AppError } from '../errors.js';

export async function telegram<T>(method: string, body: object): Promise<T> {
  if (!config.TELEGRAM_BOT_TOKEN) throw new AppError(503, 'Telegram-бот не настроен.');
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(method === 'getUpdates' ? 35000 : 15000),
    });
    const data = (await response.json()) as { ok: boolean; result: T };
    if (!response.ok || !data.ok) throw new Error('Telegram rejected request');
    return data.result;
  } catch {
    throw new AppError(502, 'Telegram недоступен. Повторите попытку позже.');
  }
}
