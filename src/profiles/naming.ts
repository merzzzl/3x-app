import { randomUUID } from 'node:crypto';

export const clientEmailPattern =
  /^(?:[1-9][0-9]{0,15}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@3x\.local$/;
export const standardEmail = (userId: string) => `${userId}@3x.local`;
export const newDeviceEmail = () => `${randomUUID()}@3x.local`;
