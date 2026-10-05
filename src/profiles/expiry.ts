import { DateTime } from 'luxon';
import { config } from '../config.js';

export function subscriptionEnd() {
  return DateTime.now().setZone(config.SUBSCRIPTION_TIMEZONE).plus({ months: 1 }).startOf('month').toMillis();
}
