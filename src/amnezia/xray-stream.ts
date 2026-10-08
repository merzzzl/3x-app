import { AppError } from '../errors.js';

type Json = Record<string, unknown>;
const invalid = (field: string) =>
  new AppError(422, `Параметр Xray «${field}» не поддерживается или некорректен. Откройте подписку.`);
export class LinkParams {
  private used = new Set<string>();
  constructor(private params: URLSearchParams) {}
  get(key: string, fallback = '') {
    this.used.add(key);
    return this.params.get(key) || fallback;
  }
  json(key: string): Json {
    try {
      const value: unknown = JSON.parse(this.get(key, '{}'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(key);
      return value as Json;
    } catch {
      throw invalid(key);
    }
  }
  finish() {
    for (const [key, value] of this.params)
      if (value && (!this.used.has(key) || this.params.getAll(key).length > 1)) throw invalid(key);
  }
}

export function xrayStream(p: LinkParams, address: string, protocol: string, credential: string): Json {
  const hy = protocol === 'hysteria';
  const network = p.get('type', hy ? 'hysteria' : 'tcp');
  if (hy && network !== 'hysteria') throw invalid('type');
  const security = p.get('security', hy || protocol === 'trojan' ? 'tls' : 'none');
  const stream: Json = { network, security };
  if (security === 'tls') {
    const alpn = p.get('alpn', hy ? 'h3' : '');
    const fingerprint = p.get('fp');
    const insecure = p.get('allowInsecure', p.get('insecure', '0'));
    if (!['0', '1', 'true', 'false'].includes(insecure)) throw invalid('insecure');
    const tls: Json = { serverName: p.get('sni', address) };
    if (alpn) tls.alpn = alpn.split(',');
    if (fingerprint && !hy) tls.fingerprint = fingerprint;
    if (['1', 'true'].includes(insecure))
      throw new AppError(
        422,
        'Xray больше не поддерживает insecure. Настройте сертификат или его отпечаток в подписке.',
      );
    for (const [key, field] of [
      ['ech', 'echConfigList'],
      ['vcn', 'verifyPeerCertByName'],
    ]) {
      const value = p.get(key);
      if (value) tls[field] = value;
    }
    const pins = p.get('pcs') || (hy ? p.get('pinSHA256') : '');
    if (pins)
      tls.pinnedPeerCertSha256 = pins
        .split(',')
        .map((value) => {
          const pin = value.trim();
          const hex = pin.replaceAll(':', '');
          if (/^[a-f\d]{64}$/i.test(hex)) return hex.toLowerCase();
          if (/^[A-Za-z0-9+/_-]{43}=?$/.test(pin)) {
            const bytes = Buffer.from(pin, 'base64');
            if (bytes.length === 32) return bytes.toString('hex');
          }
          throw invalid('pinSHA256/pcs');
        })
        .join(',');
    stream.tlsSettings = tls;
  } else if (security === 'reality' && !hy) {
    const publicKey = p.get('pbk');
    if (!publicKey) throw invalid('pbk');
    stream.realitySettings = {
      serverName: p.get('sni'),
      fingerprint: p.get('fp', 'chrome'),
      publicKey,
      shortId: p.get('sid'),
      spiderX: p.get('spx', '/'),
      mldsa65Verify: p.get('pqv'),
    };
  } else if (security !== 'none' || hy) throw invalid('security');

  if (hy) {
    stream.hysteriaSettings = { version: 2, auth: credential };
    const masks: Json[] = [];
    const obfs = p.get('obfs');
    if (obfs) {
      if (!['salamander', 'gecko'].includes(obfs)) throw invalid('obfs');
      const password = p.get('obfs-password');
      if (!password) throw invalid('obfs-password');
      const settings: Json = { password };
      if (obfs === 'gecko') {
        const min = Number(p.get('minPacketSize')),
          max = Number(p.get('maxPacketSize'));
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 2048)
          throw invalid('packetSize');
        settings.packetSize = `${min}-${max}`;
      }
      masks.push({ type: 'salamander', settings });
    }
    if (masks.length) stream.finalmask = { udp: masks };
  } else if (['ws', 'httpupgrade'].includes(network)) {
    stream[network === 'ws' ? 'wsSettings' : 'httpupgradeSettings'] = {
      path: p.get('path', '/'),
      host: p.get('host', address),
    };
  } else if (network === 'grpc') {
    const mode = p.get('mode', 'gun');
    if (!['gun', 'multi'].includes(mode)) throw invalid('mode');
    stream.grpcSettings = {
      serviceName: p.get('serviceName'),
      authority: p.get('authority'),
      multiMode: mode === 'multi',
    };
  } else if (network === 'xhttp') {
    const extra = p.json('extra');
    stream.xhttpSettings = {
      ...extra,
      path: p.get('path', '/'),
      host: p.get('host', address),
      mode: p.get('mode', 'auto'),
      ...(p.get('x_padding_bytes') ? { xPaddingBytes: p.get('x_padding_bytes') } : {}),
    };
  } else if (['tcp', 'raw'].includes(network)) {
    const header = p.get('headerType', 'none');
    if (header === 'http')
      stream.tcpSettings = {
        header: {
          type: 'http',
          request: { path: [p.get('path', '/')], headers: { Host: p.get('host', address).split(',') } },
        },
      };
    else if (header !== 'none') throw invalid('headerType');
  } else throw invalid('type');
  const finalmask = p.get('fm');
  if (finalmask) {
    if (stream.finalmask) throw invalid('fm');
    stream.finalmask = p.json('fm');
  }
  return stream;
}
