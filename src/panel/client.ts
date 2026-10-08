import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { clientDetails, expiryPayload } from './expiry.js';

const envelope = z.object({ success: z.boolean(), obj: z.unknown().optional() });
const inbound = z.object({ id: z.number(), protocol: z.string(), enable: z.boolean() });
const record = z.object({
  email: z.string(),
  subId: z.string(),
  expiryTime: z.number(),
  group: z.string(),
  comment: z.string().default(''),
  inboundIds: z.array(z.number()).nullable(),
});
function decode<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Log schema locations only, never panel values or credentials.
    const fields = result.error.issues.slice(0, 8).map((issue) => ({
      field: issue.path.map((part) => (typeof part === 'number' ? '[]' : String(part))).join('.'),
      code: issue.code,
    }));
    console.error('3X-UI response schema mismatch:', fields);
    throw new AppError(
      502,
      'Не удалось прочитать ответ 3X-UI. Поля с ошибками указаны в журнале приложения.',
    );
  }
  return result.data;
}

async function request(path: string, body?: unknown): Promise<unknown> {
  if (!config.XUI_URL || !config.XUI_API_TOKEN) {
    throw new AppError(503, 'Администратору нужно настроить подключение к 3X-UI.');
  }
  let response: Response;
  try {
    response = await fetch(`${config.XUI_URL.replace(/\/$/, '')}/panel/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${config.XUI_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    });
  } catch {
    throw new AppError(
      502,
      '3X-UI не отвечает. Результат операции неизвестен: обновите список перед повтором.',
    );
  }
  if (!response.ok)
    throw new AppError(502, `3X-UI вернул HTTP ${response.status}. Обратитесь к администратору.`);
  const parsed = envelope.safeParse(await response.json().catch(() => null));
  if (!parsed.success || !parsed.data.success) {
    throw new AppError(502, '3X-UI отклонил операцию. Проверьте API-токен, inbound’ы и журнал панели.');
  }
  return parsed.data.obj;
}

export const panel = {
  async inbounds() {
    return decode(z.array(inbound).nullable(), await request('inbounds/list/slim')) ?? [];
  },
  async find(email: string) {
    const rows = await this.clients();
    return rows.find((row) => row.email === email);
  },
  async clients() {
    return decode(z.array(record).nullable(), await request('clients/list')) ?? [];
  },
  async groups() {
    return decode(z.array(z.object({ name: z.string() })).nullable(), await request('clients/groups')) ?? [];
  },
  async ensureGroup(name: string) {
    if (!(await this.groups()).some((group) => group.name === name))
      await request('clients/groups/create', { name });
  },
  create(
    email: string,
    subId: string,
    inboundIds: number[],
    group: string,
    comment: string,
    totalGB: number,
  ) {
    // v3.8.5 fills protocol credentials, VLESS flow, WG keys and free tunnel IPs.
    return request('clients/add', {
      client: {
        email,
        subId,
        group,
        enable: true,
        limitIp: 1,
        totalGB,
        expiryTime: 0,
        comment,
        trafficReset: 'monthly',
        trafficResetDay: 1,
      },
      inboundIds,
    });
  },
  attach(email: string, inboundIds: number[]) {
    return request(`clients/${encodeURIComponent(email)}/attach`, { inboundIds });
  },
  async expire(email: string, group: string, expiryTime: number) {
    const details = decode(clientDetails, await request(`clients/get/${encodeURIComponent(email)}`));
    if (details.client.email !== email || details.client.group !== group)
      throw new AppError(404, 'Клиент не найден.');
    if (details.client.expiryTime !== 0) throw new AppError(409, 'Дата окончания уже установлена.');
    return request(`clients/update/${encodeURIComponent(email)}`, expiryPayload(details, expiryTime));
  },
};
