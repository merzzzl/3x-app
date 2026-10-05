import { z } from 'zod';
import { AppError } from '../errors.js';

const ipList = z
  .union([z.string(), z.array(z.string())])
  .nullish()
  .transform((value) =>
    (typeof value === 'string' ? value.split(',') : (value ?? [])).map((ip) => ip.trim()).filter(Boolean),
  );

// GET returns a database record; UPDATE expects protocol fields with different shapes.
export const clientDetails = z.object({
  client: z
    .object({
      email: z.string(),
      group: z.string(),
      expiryTime: z.number(),
      subId: z.string(),
      enable: z.boolean(),
      totalGB: z.number(),
      uuid: z.string().nullish(),
      id: z.union([z.number(), z.string()]).optional(),
      allowedIPs: ipList,
      reverse: z.union([z.string(), z.object({ tag: z.string() }).passthrough()]).nullish(),
      createdAt: z.number().optional(),
    })
    .passthrough(),
  tunnelAllowedIPs: z.record(z.string(), ipList).nullish(),
});

export function expiryPayload(details: z.infer<typeof clientDetails>, expiryTime: number) {
  const client = details.client;
  let reverse;
  try {
    reverse =
      typeof client.reverse === 'string'
        ? client.reverse
          ? JSON.parse(client.reverse)
          : undefined
        : (client.reverse ?? undefined);
  } catch {
    throw new AppError(502, 'Не удалось прочитать настройки клиента в панели.');
  }
  return {
    ...client,
    id: client.uuid || (typeof client.id === 'string' ? client.id : undefined),
    allowedIPs: client.allowedIPs,
    allowedIPsByInbound: details.tunnelAllowedIPs ?? undefined,
    reverse,
    created_at: client.createdAt,
    expiryTime,
    // Cancellation must not be undone by the panel's automatic renewal.
    reset: 0,
    resetDay: 0,
    resetMax: 0,
  };
}
