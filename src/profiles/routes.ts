import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../auth/session.js';
import { panel } from '../panel/client.js';
import { publicProfile, userClients } from './remote.js';
import { provision, provisioning, removeProfile, retryProfile } from './service.js';
import { requireUserGroup } from './groups.js';
import { clientEmailPattern } from './naming.js';
import { clientLimit, kinds } from './types.js';

const clientEmail = z.string().regex(clientEmailPattern);
export const profileRouter = Router();
profileRouter.use(requireAuth);
profileRouter.use(async (req, _res, next) => {
  await requireUserGroup(req.telegramUser.id);
  next();
});
profileRouter.get('/', async (req, res) => {
  const connected = Boolean(config.XUI_URL && config.XUI_API_TOKEN);
  const [clients, inbounds] = connected
    ? await Promise.all([userClients(req.telegramUser.id), panel.inbounds()])
    : [[], []];
  res.json({
    profiles: clients
      .map((client) => publicProfile(client, inbounds))
      .sort((a, b) => a.id.localeCompare(b.id)),
    options: {
      ...Object.fromEntries(
        kinds.map((kind) => [
          kind,
          connected &&
            Object.entries(config.profiles[kind]).every(([protocol, id]) =>
              inbounds.some(
                (inbound) => inbound.id === id && inbound.enable && inbound.protocol === protocol,
              ),
            ),
        ]),
      ),
      clientLimit,
    },
  });
});
profileRouter.post('/', async (req, res) => {
  const { kind } = z
    .object({
      kind: z.enum(kinds),
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
