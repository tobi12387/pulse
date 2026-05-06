export interface PulseFuelingRecoveryGuidanceItem {
  id: string;
  text: string;
}

export interface PulseFuelingRecoveryEvidence {
  label: string;
  value: string;
  status: 'supporting' | 'caution' | 'limited';
}

export interface PulseFuelingRecoveryGuidanceResponse {
  shouldShow: boolean;
  preferenceStatus: 'ready' | 'disabled';
  before: PulseFuelingRecoveryGuidanceItem[];
  during: PulseFuelingRecoveryGuidanceItem[];
  after: PulseFuelingRecoveryGuidanceItem[];
  recoveryCautions: string[];
  evidence: PulseFuelingRecoveryEvidence[];
}
