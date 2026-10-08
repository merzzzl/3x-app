import { AppError } from '../errors.js';

export function awgContainer(text: string) {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/);
    if (match) fields[match[1]] = match[2];
  }
  const required = [
    'PrivateKey',
    'PublicKey',
    'Address',
    'Endpoint',
    'AllowedIPs',
    'Jc',
    'Jmin',
    'Jmax',
    'S1',
    'S2',
    'H1',
    'H2',
    'H3',
    'H4',
  ];
  if (required.some((field) => !fields[field]) || (text.match(/\[Peer\]/g) ?? []).length !== 1)
    throw new AppError(422, 'Не удалось прочитать конфигурацию AmneziaWG. Откройте подписку.');
  const endpoint = new URL(`http://${fields.Endpoint}`);
  if (!endpoint.port) throw new AppError(422, 'В конфигурации AmneziaWG отсутствует порт.');
  const host = endpoint.hostname.replace(/^\[|\]$/g, '');
  const last: Record<string, unknown> = {
    config: text,
    hostName: host,
    port: Number(endpoint.port),
    client_priv_key: fields.PrivateKey,
    client_ip: fields.Address,
    server_pub_key: fields.PublicKey,
    psk_key: fields.PresharedKey ?? fields.PreSharedKey ?? '',
    mtu: fields.MTU ?? '1280',
    allowed_ips: fields.AllowedIPs.split(/\s*,\s*/),
    ...(fields.PersistentKeepalive ? { persistent_keep_alive: fields.PersistentKeepalive } : {}),
  };
  for (const key of [
    'Jc',
    'Jmin',
    'Jmax',
    'S1',
    'S2',
    'S3',
    'S4',
    'H1',
    'H2',
    'H3',
    'H4',
    'I1',
    'I2',
    'I3',
    'I4',
    'I5',
  ])
    if (fields[key]) last[key] = fields[key];
  const version =
    fields.S3 && fields.S4 ? '2' : ['I1', 'I2', 'I3', 'I4', 'I5'].some((key) => fields[key]) ? '1.5' : '';
  return {
    host,
    dns: fields.DNS?.split(/\s*,\s*/),
    container: {
      container: 'amnezia-awg',
      awg: {
        last_config: JSON.stringify(last),
        isThirdPartyConfig: true,
        port: endpoint.port,
        transport_proto: 'udp',
        ...(version ? { protocol_version: version } : {}),
      },
    },
  };
}
