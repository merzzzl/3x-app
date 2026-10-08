import { AppError } from '../errors.js';

type Json = Record<string, unknown>;
const unsupported = () =>
  new AppError(422, 'Параметры Xray не поддерживаются экспортом. Откройте страницу подписки.');

export function xrayOutbound(link: string, index: number): Json {
  const url = new URL(link);
  const p = url.searchParams;
  const get = (key: string, fallback = '') => p.get(key) ?? fallback;
  const protocol = url.protocol.slice(0, -1);
  const hy = ['hysteria2', 'hy2'].includes(protocol);
  if (!hy && !['vless', 'trojan'].includes(protocol)) throw unsupported();
  // Reject unknown options instead of silently producing a different connection.
  const allowed = new Set([
    'type',
    'security',
    'sni',
    'alpn',
    'fp',
    'allowInsecure',
    'insecure',
    'encryption',
    'flow',
    'pbk',
    'sid',
    'spx',
    'path',
    'host',
    'serviceName',
    'mode',
    'headerType',
  ]);
  for (const key of p.keys()) if (!allowed.has(key)) throw unsupported();
  const address = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port || 443);
  const credential = decodeURIComponent(url.username + (url.password ? `:${url.password}` : ''));
  if (!address || !credential || !Number.isInteger(port) || port < 1 || port > 65535) throw unsupported();
  const security = get('security', hy || protocol === 'trojan' ? 'tls' : 'none');
  const network = hy ? 'hysteria' : get('type', 'tcp');
  const stream: Json = { network, security };
  if (security === 'tls') {
    stream.tlsSettings = {
      serverName: get('sni', address),
      ...(get('alpn') || hy ? { alpn: get('alpn', 'h3').split(',') } : {}),
      ...(!hy && get('fp') ? { fingerprint: get('fp') } : {}),
      allowInsecure: ['1', 'true'].includes(get('allowInsecure', get('insecure'))),
    };
  } else if (security === 'reality' && !hy) {
    if (!get('pbk')) throw unsupported();
    stream.realitySettings = {
      serverName: get('sni'),
      fingerprint: get('fp', 'chrome'),
      publicKey: get('pbk'),
      shortId: get('sid'),
      spiderX: get('spx', '/'),
    };
  } else if (security !== 'none' || hy) throw unsupported();
  if (hy) stream.hysteriaSettings = { version: 2, auth: credential };
  else if (network === 'ws')
    stream.wsSettings = { path: get('path', '/'), headers: { Host: get('host', address) } };
  else if (network === 'grpc')
    stream.grpcSettings = { serviceName: get('serviceName'), multiMode: get('mode') === 'multi' };
  else if (!['tcp', 'raw'].includes(network) || !['', 'none'].includes(get('headerType')))
    throw unsupported();
  const settings = hy
    ? { version: 2, address, port }
    : protocol === 'vless'
      ? {
          vnext: [
            {
              address,
              port,
              users: [{ id: credential, encryption: get('encryption', 'none'), flow: get('flow') }],
            },
          ],
        }
      : { servers: [{ address, port, password: credential }] };
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
