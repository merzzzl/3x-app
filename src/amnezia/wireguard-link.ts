import { AppError } from '../errors.js';

// 3X-UI exports ordinary WireGuard as a URI, whereas AWG uses base64 .conf text.
export function wireguardLinkConfig(link: string) {
  const url = new URL(link);
  const params = new Map<string, string>();
  for (const [key, value] of url.searchParams) {
    if (params.has(key) || /[\r\n\x00]/.test(value))
      throw new AppError(422, 'Некорректные параметры WireGuard. Откройте подписку.');
    params.set(key, value);
  }
  const supported = ['publickey', 'address', 'mtu', 'dns', 'presharedkey', 'keepalive', 'allowedips'];
  if ([...params.keys()].some((key) => !supported.includes(key)))
    throw new AppError(422, 'Неподдерживаемые параметры WireGuard. Откройте подписку.');
  const privateKey = decodeURIComponent(url.username);
  const validKey = (key: string) => /^[A-Za-z0-9+/]{43}=$/.test(key);
  if (
    !validKey(privateKey) ||
    !validKey(params.get('publickey') ?? '') ||
    (params.has('presharedkey') && !validKey(params.get('presharedkey')!)) ||
    !params.get('address') ||
    !url.hostname ||
    !url.port ||
    Number(url.port) < 1 ||
    url.password ||
    (url.pathname && url.pathname !== '/')
  )
    throw new AppError(422, 'В подписке некорректная ссылка WireGuard.');
  for (const key of ['mtu', 'keepalive']) {
    const value = params.get(key);
    if (
      value !== undefined &&
      (!/^\d+$/.test(value) || Number(value) > 65535 || (key === 'mtu' && Number(value) < 576))
    )
      throw new AppError(422, 'В подписке некорректный MTU или Keepalive WireGuard.');
  }
  return [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${params.get('address')}`,
    ...(params.get('dns') ? [`DNS = ${params.get('dns')}`] : []),
    ...(params.get('mtu') ? [`MTU = ${params.get('mtu')}`] : []),
    '[Peer]',
    `PublicKey = ${params.get('publickey')}`,
    ...(params.get('presharedkey') ? [`PresharedKey = ${params.get('presharedkey')}`] : []),
    `Endpoint = ${url.host}`,
    `AllowedIPs = ${params.get('allowedips') || '0.0.0.0/0, ::/0'}`,
    ...(params.has('keepalive') ? [`PersistentKeepalive = ${params.get('keepalive')}`] : []),
  ].join('\n');
}
