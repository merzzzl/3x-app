import { panel } from '../panel/client.js';
import { standardEmail } from './naming.js';
import { AppError } from '../errors.js';

export async function hasUserGroup(userId: string) {
  return (await panel.groups()).some((group) => group.name === standardEmail(userId));
}
export async function requireUserGroup(userId: string) {
  if (!(await hasUserGroup(userId))) throw new AppError(403, 'Доступ ещё не подтверждён администратором.');
  return standardEmail(userId);
}
