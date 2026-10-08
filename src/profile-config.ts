import { readFileSync } from 'node:fs';
import { z } from 'zod';

const group = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,31}$/)
      .refine((id) => id !== 'unknown'),
    name: z.string().trim().min(1).max(60),
    inboundIds: z.array(z.number().int().positive()).min(1),
    trafficGB: z.number().positive().max(1000000),
  })
  .strict();
const groups = z
  .array(group)
  .min(1)
  .max(30)
  .superRefine((items, context) => {
    const ids = new Set<string>();
    const inbounds = new Set<number>();
    for (const item of items) {
      if (ids.has(item.id)) context.addIssue({ code: 'custom', message: `Duplicate group id: ${item.id}` });
      ids.add(item.id);
      for (const inbound of item.inboundIds) {
        if (inbounds.has(inbound))
          context.addIssue({
            code: 'custom',
            message: `Inbound ${inbound} belongs to multiple groups or is repeated`,
          });
        inbounds.add(inbound);
      }
    }
  });

export function loadProfileGroups(path: string) {
  return groups.parse(JSON.parse(readFileSync(path, 'utf8')));
}
export type ProfileGroup = z.infer<typeof group>;
