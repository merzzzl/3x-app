import { z } from 'zod';
import { AppError } from '../errors.js';

// GET returns a database record; UPDATE expects protocol fields with different shapes.
export const clientDetails = z.object({
  client: z
    .object({
      email: z.string(),
      group: z.string(),
      expiryTime: z.number(),
      uuid: z.string(),
      allowedIPs: z.string(),
      reverse: z.string(),
      createdAt: z.number(),
    })
    .passthrough(),
  tunnelAllowedIPs: z.record(z.string(), z.string()).nullable(),
});

export function expiryPayload(details: z.infer<typeof clientDetails>, expiryTime: number) {
  const client = details.client;
  let reverse;
  try {
    reverse = client.reverse ? JSON.parse(client.reverse) : undefined;
  } catch {
    throw new AppError(502, 'Не удалось прочитать настройки клиента в панели.');
  }
  return {
    ...client,
    id: client.uuid,
    allowedIPs: client.allowedIPs
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
    allowedIPsByInbound: details.tunnelAllowedIPs
      ? Object.fromEntries(
          Object.entries(details.tunnelAllowedIPs).map(([id, ips]) => [
            id,
            ips
              .split(',')
              .map((ip) => ip.trim())
              .filter(Boolean),
          ]),
        )
      : undefined,
    reverse,
    created_at: client.createdAt,
    expiryTime,
    // Cancellation must not be undone by the panel's automatic renewal.
    reset: 0,
    resetDay: 0,
    resetMax: 0,
  };
}
