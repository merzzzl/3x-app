import { AppError } from '../errors.js';
import { subscriptionKey } from './key.js';

function subscriptionLinks(body: string) {
  const plain = body.trim();
  const decoded =
    plain.includes('://') || plain.startsWith('[Interface]')
      ? plain
      : Buffer.from(plain, 'base64').toString('utf8').trim();
  const links = decoded.startsWith('[Interface]')
    ? [decoded]
    : [
        ...new Set(
          decoded
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
  if (!links.length || links.length > 100)
    throw new AppError(422, 'Подписка пуста или содержит слишком много подключений.');
  return links;
}

function telegramProxy(link: string): string | null {
  const url = new URL(link);
  const isProxy =
    (url.protocol === 'tg:' && url.hostname === 'proxy') ||
    (['https:', 'http:'].includes(url.protocol) &&
      ['t.me', 'telegram.me'].includes(url.hostname) &&
      url.pathname === '/proxy');
  if (!isProxy) return null;
  const server = url.searchParams.get('server');
  const port = url.searchParams.get('port');
  const secret = url.searchParams.get('secret');
  if (!server || !port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !secret)
    throw new AppError(422, 'В подписке некорректная ссылка MTProto.');
  return `https://t.me/proxy?${new URLSearchParams({ server, port, secret })}`;
}

export function subscriptionActions(body: string, description: string) {
  const vpn: string[] = [];
  const telegramLinks: string[] = [];
  for (const link of subscriptionLinks(body)) {
    const telegram = link.startsWith('[Interface]') ? null : telegramProxy(link);
    if (telegram) telegramLinks.push(telegram);
    else vpn.push(link);
  }
  const hasVpn = vpn.some(
    (link) => /^(vless|trojan|hysteria2|hy2|vpn):\/\//.test(link) || link.startsWith('[Interface]'),
  );
  let key: string | null = null;
  let keyError: string | null = null;
  if (hasVpn) {
    try {
      key = subscriptionKey(vpn, description);
    } catch (error) {
      keyError =
        error instanceof AppError
          ? error.message
          : 'Не удалось сформировать ключ Amnezia. Откройте подписку.';
    }
  }
  return { key, hasVpn, keyError, telegramLinks: [...new Set(telegramLinks)] };
}
