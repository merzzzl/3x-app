import { deflateSync } from 'node:zlib';
import { AppError } from '../errors.js';
import { wireguardContainer } from './wireguard.js';
import { wireguardLinkConfig } from './wireguard-link.js';
import { xrayContainer, xrayOutbound } from './xray.js';

export function subscriptionKey(links: string[], description: string) {
  const outbounds: Record<string, unknown>[] = [];
  const tunnels = new Map<string, ReturnType<typeof wireguardContainer>>();
  let host = '';
  for (const link of links) {
    if (/^(vpn|wireguard):\/\//.test(link) || link.startsWith('[Interface]')) {
      const text = link.startsWith('wireguard://')
        ? wireguardLinkConfig(link)
        : link.startsWith('vpn://')
          ? Buffer.from(link.slice(6), 'base64url').toString('utf8')
          : link;
      const tunnel = wireguardContainer(text);
      const type = tunnel.container.container;
      if (tunnels.has(type))
        throw new AppError(422, 'В одном ключе поддерживается не более одного WireGuard и одного AmneziaWG.');
      tunnels.set(type, tunnel);
    } else {
      outbounds.push(xrayOutbound(link, outbounds.length));
      host ||= new URL(link).hostname.replace(/^\[|\]$/g, '');
    }
  }
  const ordered = ['amnezia-awg', 'amnezia-wireguard'].flatMap((type) => {
    const tunnel = tunnels.get(type);
    return tunnel ? [tunnel] : [];
  });
  const containers = [
    ...(outbounds.length ? [xrayContainer(outbounds)] : []),
    ...ordered.map((tunnel) => tunnel.container),
  ];
  const payload = Buffer.from(
    JSON.stringify({
      description,
      hostName: host || ordered[0]?.host,
      dns1: ordered[0]?.dns?.[0] ?? '1.1.1.1',
      dns2: ordered[0]?.dns?.[1] ?? '1.0.0.1',
      defaultContainer: containers[0].container,
      containers,
    }),
  );
  // Qt qCompress prepends the uncompressed length as a big-endian uint32.
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  return `vpn://${Buffer.concat([length, deflateSync(payload, { level: 8 })]).toString('base64url')}`;
}
