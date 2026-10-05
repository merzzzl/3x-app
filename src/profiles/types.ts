export const kinds = ['tls', 'mtproto', 'wireguard', 'amneziawg'] as const;
export type Kind = (typeof kinds)[number];
export const clientLimit = 10;
export const profileNames: Record<Kind, string> = {
  tls: 'TLS',
  mtproto: 'MTProto',
  wireguard: 'WireGuard',
  amneziawg: 'AmneziaWG',
};
