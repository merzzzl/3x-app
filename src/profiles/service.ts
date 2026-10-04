import { randomUUID } from 'node:crypto';
import { Mutex } from 'async-mutex';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { panel } from '../panel/client.js';
import { requireUserGroup } from './groups.js';
import { standardEmail as userEmail, newDeviceEmail } from './naming.js';
import { getClient, publicProfile, ownsClient, userClients, type Kind } from './remote.js';

export const provisioning = new Mutex();

async function validateInbounds(kind: Kind) {
  const entries =
    kind === 'standard' ? Object.entries(config.standard) : ([[kind, config.tunnels[kind]]] as const);
  const inbounds = await panel.inbounds();
  const ids: number[] = [];
  for (const [protocol, id] of entries) {
    if (!id || !inbounds.some((item) => item.id === id && item.enable && item.protocol === protocol)) {
      throw new AppError(503, `Inbound для ${protocol} недоступен или имеет другой протокол.`);
    }
    ids.push(id);
  }
  return ids;
}

export async function provision(userId: string, kind: Kind, name: string, retryEmail?: string) {
  const group = await requireUserGroup(userId);
  const clients = await userClients(userId);
  const standardEmail = userEmail(userId);
  const existing = clients.find(
    (client) => client.email === (retryEmail ?? (kind === 'standard' ? standardEmail : '')),
  );
  if (retryEmail && !existing) throw new AppError(404, 'Клиент удалён из 3X-UI. Создайте новый профиль.');
  if (
    !existing &&
    kind !== 'standard' &&
    clients.filter((client) => client.email !== standardEmail).length >= 5
  ) {
    throw new AppError(409, 'Можно создать не больше пяти дополнительных конфигураций.');
  }
  const ids = await validateInbounds(kind);
  const email = existing?.email ?? (kind === 'standard' ? standardEmail : newDeviceEmail());
  if (!existing && (await panel.find(email))) throw new AppError(409, 'Имя клиента уже занято в панели.');
  if (existing) {
    const missing = ids.filter((id) => !existing.inboundIds?.includes(id));
    if (missing.length) await panel.attach(email, missing);
  } else {
    await panel.create(email, randomUUID(), ids, group, name);
  }
  const current = await getClient(userId, email);
  if (current.group !== group || ids.some((id) => !current.inboundIds?.includes(id))) {
    throw new AppError(502, 'Профиль создан частично. Обновите список и повторите создание.');
  }
  return publicProfile(current, await panel.inbounds());
}

export async function retryProfile(userId: string, email: string) {
  const profile = publicProfile(await getClient(userId, email), await panel.inbounds());
  if (profile.kind === 'unknown')
    throw new AppError(409, 'Протокол не определён. Удалите профиль и создайте его заново.');
  return provision(userId, profile.kind, profile.name, email);
}

export async function removeProfile(userId: string, email: string) {
  const client = await panel.find(email);
  if (!client) return;
  if (!ownsClient(userId, client)) throw new AppError(404, 'Клиент не найден.');
  await panel.remove(email);
  if (await panel.find(email)) throw new AppError(502, 'Удаление ещё не завершено. Обновите список.');
}
