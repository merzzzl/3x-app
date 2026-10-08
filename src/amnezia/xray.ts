import { AppError } from '../errors.js';
import { LinkParams, xrayStream } from './xray-stream.js';

type Json = Record<string, unknown>;
const unsupported = () =>
  new AppError(422, 'Параметры Xray не поддерживаются экспортом. Откройте страницу подписки.');

export function xrayOutbound(link: string, index: number): Json {
  const url = new URL(link);
  const p = new LinkParams(url.searchParams);
  const protocol = url.protocol.slice(0, -1);
  const hy = ['hysteria2', 'hy2'].includes(protocol);
  if (!hy && !['vless', 'trojan'].includes(protocol)) throw unsupported();
  const address = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port || 443);
  const credential = decodeURIComponent(url.username + (url.password ? `:${url.password}` : ''));
  if (!address || !credential || !Number.isInteger(port) || port < 1 || port > 65535) throw unsupported();
  const stream = xrayStream(p, address, hy ? 'hysteria' : protocol, credential);
  const settings = hy
    ? { version: 2, address, port }
    : protocol === 'vless'
      ? {
          vnext: [
            {
              address,
              port,
              users: [{ id: credential, encryption: p.get('encryption', 'none'), flow: p.get('flow') }],
            },
          ],
        }
      : { servers: [{ address, port, password: credential }] };
  p.finish();
  return { tag: `proxy-${index}`, protocol: hy ? 'hysteria' : protocol, settings, streamSettings: stream };
}

export function xrayContainer(outbounds: Json[]) {
  const client = {
    log: { loglevel: 'warning' },
    inbounds: [{ listen: '127.0.0.1', port: 10808, protocol: 'socks', settings: { udp: true } }],
    outbounds,
    ...(outbounds.length > 1
      ? {
          routing: {
            balancers: [{ tag: 'random', selector: ['proxy-'], strategy: { type: 'random' } }],
            rules: [{ type: 'field', network: 'tcp,udp', balancerTag: 'random' }],
          },
        }
      : {}),
  };
  return {
    container: 'amnezia-xray',
    xray: { last_config: JSON.stringify(client), isThirdPartyConfig: true },
  };
}
