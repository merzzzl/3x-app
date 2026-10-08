import { AppError } from '../errors.js';
import { getClient, subscriptionUrl } from '../profiles/remote.js';
import { matchProfileGroup } from '../profiles/types.js';
import { subscriptionActions } from './subscription.js';

export async function clientConnections(userId: string, email: string) {
  const client = await getClient(userId, email);
  const url = subscriptionUrl(client);
  if (!url) throw new AppError(503, 'Ссылка на подписку не настроена.');
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/plain', 'User-Agent': '3X-APP/1.0' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok || !response.body) throw new AppError(502, 'Не удалось получить подписку из 3X-UI.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1024 * 1024) throw new AppError(502, 'Размер подписки превышает 1 МБ.');
      chunks.push(chunk);
    }
    const group = matchProfileGroup(client.inboundIds ?? []);
    const name = group?.name ?? 'Подключение';
    return subscriptionActions(Buffer.concat(chunks).toString('utf8'), `${name} (${client.email})`);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'Не удалось прочитать подключения из подписки. Откройте страницу подписки.');
  }
}
