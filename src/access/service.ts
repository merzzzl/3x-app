import { randomBytes } from 'node:crypto';
import { Mutex } from 'async-mutex';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { panel } from '../panel/client.js';
import { hasUserGroup } from '../profiles/groups.js';
import { standardEmail } from '../profiles/naming.js';
import { telegram } from '../telegram/api.js';
import { state, save } from './store.js';

const lock = new Mutex();
export const adminIds = () =>
  config.TELEGRAM_ADMIN_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
export const approvalConfigured = () => Boolean(config.TELEGRAM_ADMIN_CHAT_ID && adminIds().length);
export async function accessStatus(userId: string) {
  if (await hasUserGroup(userId)) return { status: 'approved' };
  const status = state.requests[userId]?.status;
  return { status: status === 'approved' ? 'revoked' : (status ?? 'none') };
}
export async function requestAccess(userId: string) {
  return lock.runExclusive(async () => {
    const status = await accessStatus(userId);
    if (status.status !== 'none') return status;
    if (!approvalConfigured()) throw new AppError(503, 'Администратор ещё не настроен.');
    const entry = {
      userId,
      nonce: randomBytes(12).toString('hex'),
      status: 'pending' as const,
      chatId: config.TELEGRAM_ADMIN_CHAT_ID,
    };
    state.requests[userId] = entry;
    save();
    try {
      const message = await telegram<{ message_id: number }>('sendMessage', {
        chat_id: entry.chatId,
        text: `Заявка на доступ к 3X APP\nTelegram ID: ${userId}\nГруппа: ${standardEmail(userId)}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Подтвердить', callback_data: `access:yes:${userId}:${entry.nonce}` },
              { text: 'Отклонить', callback_data: `access:no:${userId}:${entry.nonce}` },
            ],
          ],
        },
      });
      state.requests[userId] = { ...entry, messageId: message.message_id };
      save();
    } catch (error) {
      delete state.requests[userId];
      save();
      throw error;
    }
    return { status: 'pending' };
  });
}
export interface Callback {
  id: string;
  from: { id: number };
  data?: string;
  message?: { message_id: number; chat: { id: number } };
}
export async function decideAccess(query: Callback) {
  return lock.runExclusive(async () => {
    const match = /^access:(yes|no):([1-9][0-9]*):([a-f0-9]{24})$/.exec(query.data ?? '');
    const entry = match ? state.requests[match[2]] : undefined;
    if (
      !entry ||
      !adminIds().includes(String(query.from.id)) ||
      String(query.message?.chat.id) !== config.TELEGRAM_ADMIN_CHAT_ID ||
      entry.chatId !== config.TELEGRAM_ADMIN_CHAT_ID ||
      entry.nonce !== match![3] ||
      entry.messageId !== query.message?.message_id
    ) {
      await telegram('answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Заявка недоступна.',
        show_alert: true,
      });
      return;
    }
    if (entry.status === 'pending') {
      if (match![1] === 'yes') {
        await panel.ensureGroup(standardEmail(entry.userId));
        if (!(await hasUserGroup(entry.userId)))
          throw new AppError(502, 'Группа не создана. Нажмите подтвердить ещё раз.');
      }
      entry.status = match![1] === 'yes' ? 'approved' : 'rejected';
      save();
    }
    const text = entry.status === 'approved' ? 'Доступ подтверждён' : 'Заявка отклонена';
    await telegram('answerCallbackQuery', { callback_query_id: query.id, text });
    await telegram('editMessageText', {
      chat_id: entry.chatId,
      message_id: entry.messageId,
      text: `${text}\nTelegram ID: ${entry.userId}`,
      reply_markup: { inline_keyboard: [] },
    });
  });
}
