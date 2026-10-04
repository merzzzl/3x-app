import { setTimeout } from 'node:timers/promises';
import { config } from '../config.js';
import { approvalConfigured, decideAccess, type Callback } from '../access/service.js';
import { state, save } from '../access/store.js';
import { telegram } from './api.js';

interface Update {
  update_id: number;
  callback_query?: Callback;
}
export async function startPolling() {
  if (!config.TELEGRAM_BOT_TOKEN || !approvalConfigured()) return;
  const webhook = await telegram<{ url: string }>('getWebhookInfo', {});
  if (webhook.url) {
    console.error('Telegram polling disabled: an existing webhook is configured.');
    return;
  }
  console.log('Telegram approval polling started');
  for (;;) {
    try {
      const updates = await telegram<Update[]>('getUpdates', {
        offset: state.offset,
        timeout: 25,
        allowed_updates: ['callback_query'],
      });
      for (const update of updates) {
        if (update.callback_query) {
          try {
            await decideAccess(update.callback_query);
          } catch {
            await telegram('answerCallbackQuery', {
              callback_query_id: update.callback_query.id,
              text: 'Операция не завершена. Нажмите кнопку повторно.',
              show_alert: true,
            }).catch(() => {});
          }
        }
        state.offset = update.update_id + 1;
        save();
      }
    } catch {
      console.error('Telegram polling unavailable; retrying');
      await setTimeout(5000);
    }
  }
}
