export const kinds = ['tls', 'mtproto', 'wireguard', 'amneziawg'] as const;
export type Kind = (typeof kinds)[number];
export const clientLimit = 10;
export const profileNames: Record<Kind, string> = {
  tls: 'TLS',
  mtproto: 'MTProto',
  wireguard: 'WireGuard',
  amneziawg: 'AmneziaWG',
};

export const trafficLimitsGB: Record<Kind, number> = {
  tls: 200,
  mtproto: 200,
  wireguard: 50,
  amneziawg: 50,
};
