import type { PushLeadTime } from '../../database/schema';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionDto {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export class RegisterPushReminderDto {
  matchId!: number;
  leadTime!: PushLeadTime;
  subscription?: PushSubscriptionDto;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
}
