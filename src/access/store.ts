import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { errorDetails } from '../diagnostics.js';

const record = z.object({
  userId: z.string(),
  nonce: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  chatId: z.string(),
  messageId: z.number().optional(),
});
const schema = z.object({ offset: z.number().default(0), requests: z.record(z.string(), record) });
export type Approval = z.infer<typeof record>;
export const state = existsSync(config.APPROVALS_FILE)
  ? schema.parse(JSON.parse(readFileSync(config.APPROVALS_FILE, 'utf8')))
  : { offset: 0, requests: {} as Record<string, Approval> };
export function save() {
  try {
    mkdirSync(dirname(config.APPROVALS_FILE), { recursive: true, mode: 0o700 });
    const temp = `${config.APPROVALS_FILE}.tmp`;
    writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    renameSync(temp, config.APPROVALS_FILE);
  } catch (error) {
    console.error('Approval storage write failed:', errorDetails(error));
    throw new AppError(
      503,
      'Не удалось сохранить заявку. Администратору нужно проверить хранилище приложения.',
    );
  }
}
