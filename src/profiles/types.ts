export const kinds = ['tls', 'wireguard'] as const;
export type Kind = (typeof kinds)[number];
export const clientLimit = 10;
export const profileNames: Record<Kind, string> = {
  tls: 'TLS',
  wireguard: 'WireGuard',
};

export const trafficLimitsGB: Record<Kind, number> = {
  tls: 200,
  wireguard: 50,
};
