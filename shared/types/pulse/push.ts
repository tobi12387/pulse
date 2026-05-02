// Web Push Pulse contracts.
export type PushTopic = 'briefing' | 'checkin_reminder' | 'risk_critical';

export type PulsePushTopics = Record<PushTopic, boolean>;

export interface PulsePushSubscription {
  id: string;
  endpoint: string;
  deviceLabel: string | null;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PulsePushSettings {
  configured: boolean;
  publicKey: string | null;
  topics: PulsePushTopics;
  quietHours: {
    start: string;
    end: string;
  };
  subscriptions: PulsePushSubscription[];
}
