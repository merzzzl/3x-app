import { deflateSync } from 'node:zlib';
import { AppError } from '../errors.js';
import { awgContainer } from './awg.js';
import { xrayContainer, xrayOutbound } from './xray.js';

export function subscriptionKey(links: string[], description: string) {
  const outbounds: Record<string, unknown>[] = [];
  let awg: ReturnType<typeof awgContainer> | undefined;
  let host = '';
  for (const link of links) {
    if (link.startsWith('vpn://') || link.startsWith('[Interface]')) {
      if (awg) throw new AppError(422, 'В одном ключе поддерживается только один контейнер AmneziaWG.');
      const text = link.startsWith('vpn://')
        ? Buffer.from(link.slice(6), 'base64url').toString('utf8')
        : link;
      awg = awgContainer(text);
    } else {
      outbounds.push(xrayOutbound(link, outbounds.length));
      host ||= new URL(link).hostname.replace(/^\[|\]$/g, '');
    }
  }
  const containers = [
    ...(outbounds.length ? [xrayContainer(outbounds)] : []),
    ...(awg ? [awg.container] : []),
  ];
  const payload = Buffer.from(
    JSON.stringify({
      description,
      hostName: host || awg?.host,
      dns1: awg?.dns?.[0] ?? '1.1.1.1',
      dns2: awg?.dns?.[1] ?? '1.0.0.1',
      defaultContainer: containers[0].container,
      containers,
    }),
  );
  // Qt qCompress prepends the uncompressed length as a big-endian uint32.
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  return `vpn://${Buffer.concat([length, deflateSync(payload, { level: 8 })]).toString('base64url')}`;
}
