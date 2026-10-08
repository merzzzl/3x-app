import { Router } from 'express';
import { clientConnections } from '../amnezia/service.js';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../auth/session.js';
import { panel } from '../panel/client.js';
import { publicProfile, userClients } from './remote.js';
import { provision, provisioning, removeProfile, retryProfile } from './service.js';
import { requireUserGroup } from './groups.js';
import { clientEmailPattern } from './naming.js';
import { clientLimit } from './types.js';
import { subscriptionEnd } from './expiry.js';

const clientEmail = z.string().regex(clientEmailPattern);
export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.use(async (req, _res, next) => {
  await requireUserGroup(req.telegramUser.id);
  next();
});
profileRouter.get('/', async (req, res) => {
  const connected = Boolean(config.XUI_URL && config.XUI_API_TOKEN);
  const [clients, inbounds, online] = connected
    ? await Promise.all([
        userClients(req.telegramUser.id),
        panel.inbounds(),
        panel.onlines().catch(() => null),
      ])
    : [[], [], null];
  const onlineEmails = online ? new Set(online) : null;
  res.json({
    profiles: clients
      .map((client) => publicProfile(client, inbounds, onlineEmails))
      .sort((a, b) => a.id.localeCompare(b.id)),
    options: {
      groups: config.profiles.map((group) => ({
        id: group.id,
        name: group.name,
        trafficGB: group.trafficGB,
        available:
          connected && group.inboundIds.every((id) => inbounds.some((item) => item.id === id && item.enable)),
      })),
      clientLimit,
      cancellationTime: subscriptionEnd(),
      timeZone: config.SUBSCRIPTION_TIMEZONE,
    },
  });
});
profileRouter.get('/:id/key', async (req, res) => {
  res.json(await clientConnections(req.telegramUser.id, clientEmail.parse(req.params.id)));
});
profileRouter.post('/', async (req, res) => {
  const { kind } = z
    .object({
      kind: z.string().min(1).max(32),
    })
    .parse(req.body);
  res.status(201).json(await provisioning.runExclusive(() => provision(req.telegramUser.id, kind)));
});
profileRouter.post('/:id/retry', async (req, res) => {
  await provisioning.runExclusive(() => retryProfile(req.telegramUser.id, clientEmail.parse(req.params.id)));
  res.sendStatus(204);
});
profileRouter.delete('/:id', async (req, res) => {
  await provisioning.runExclusive(() => removeProfile(req.telegramUser.id, clientEmail.parse(req.params.id)));
  res.sendStatus(204);
});
