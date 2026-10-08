import { AppError } from '../errors.js';
import { awgFields, awgVersion } from './awg-fields.js';

export function awgContainer(text: string) {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/);
    if (match) fields[match[1]] = match[2];
  }
  const required = ['PrivateKey', 'PublicKey', 'Address', 'Endpoint', 'AllowedIPs'];
  if (
    required.some((field) => !fields[field]) ||
    !awgFields.some((field) => fields[field]) ||
    (text.match(/\[Peer\]/g) ?? []).length !== 1
  )
    throw new AppError(422, 'Не удалось прочитать конфигурацию AmneziaWG. Откройте подписку.');
  // A neutral scheme preserves ports 80/443, unlike http/https URL defaults.
  const endpoint = new URL(`udp://${fields.Endpoint}`);
  if (!endpoint.hostname || !endpoint.port || Number(endpoint.port) < 1 || Number(endpoint.port) > 65535)
    throw new AppError(422, 'В конфигурации AmneziaWG некорректный адрес или порт.');
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
  for (const key of awgFields) if (fields[key]) last[key] = fields[key];
  const version = awgVersion(fields);
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
