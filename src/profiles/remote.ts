import { config } from '../config.js';
import { AppError } from '../errors.js';
import { clientEmailPattern, standardEmail } from './naming.js';
import { panel } from '../panel/client.js';

export type Kind = 'standard' | 'wireguard' | 'amneziawg';
export type PanelClient = Awaited<ReturnType<typeof panel.clients>>[number];
export type Inbound = Awaited<ReturnType<typeof panel.inbounds>>[number];

export function ownsClient(userId: string, client: PanelClient) {
  return (
    client.group === standardEmail(userId) &&
    clientEmailPattern.test(client.email) &&
    (client.email === standardEmail(userId) || client.email.includes('-'))
  );
}

export async function userClients(userId: string) {
  return (await panel.clients()).filter((client) => ownsClient(userId, client));
}

export async function getClient(userId: string, email: string) {
  const client = await panel.find(email);
  if (!client || !ownsClient(userId, client)) throw new AppError(404, 'Клиент не найден. Обновите список.');
  return client;
}

function clientName(client: PanelClient) {
  const comment = client.comment.trim();
  return comment || client.email;
}

export function subscriptionUrl(client: PanelClient): string | null {
  if (!config.XUI_SUBSCRIPTION_URL || !client.subId) return null;
  const base = new URL(config.XUI_SUBSCRIPTION_URL);
  if (!['https:', 'http:'].includes(base.protocol)) return null;
  base.pathname = `${base.pathname.replace(/\/$/, '')}/${encodeURIComponent(client.subId)}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

export function publicProfile(
  client: PanelClient,
  inbounds: Inbound[],
): {
  id: string;
  name: string;
  kind: Kind | 'unknown';
  status: 'ready' | 'error';
  subscriptionUrl: string | null;
} {
  const ids = client.inboundIds ?? [];
  const protocols = inbounds.filter((item) => ids.includes(item.id)).map((item) => item.protocol);
  const kind = /^[1-9][0-9]*@3x\.local$/.test(client.email)
    ? 'standard'
    : protocols.includes('amneziawg')
      ? 'amneziawg'
      : protocols.includes('wireguard')
        ? 'wireguard'
        : 'unknown';
  const complete =
    kind === 'standard'
      ? Object.values(config.standard).every((id) => id !== undefined && ids.includes(id))
      : kind !== 'unknown' && protocols.includes(kind);
  return {
    id: client.email,
    name: kind === 'standard' ? 'Основной профиль' : clientName(client),
    kind,
    status: complete ? 'ready' : 'error',
    subscriptionUrl: subscriptionUrl(client),
  };
}
