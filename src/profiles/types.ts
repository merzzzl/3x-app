import { config } from '../config.js';
import { AppError } from '../errors.js';

export const clientLimit = 10;
export function profileGroup(id: string) {
  const group = config.profiles.find((item) => item.id === id);
  if (!group) throw new AppError(400, 'Этот тип клиента больше недоступен. Обновите список.');
  return group;
}
export function matchProfileGroup(inboundIds: number[]) {
  const candidates = config.profiles.filter((group) =>
    group.inboundIds.some((id) => inboundIds.includes(id)),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
