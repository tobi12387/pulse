export type HomeSurfaceFocus = 'balanced' | 'training' | 'mental' | 'review';

export type HomeFocusSlot =
  | 'delta'
  | 'todayOptions'
  | 'adaptation'
  | 'mental'
  | 'action'
  | 'history'
  | 'learning'
  | 'followUps';

export const HOME_SURFACE_STORAGE_KEY = 'pulse.home.surface.focus.v1';

export const HOME_SURFACE_ORDER: Record<HomeSurfaceFocus, HomeFocusSlot[]> = {
  balanced: ['delta', 'todayOptions', 'adaptation', 'mental', 'action', 'history', 'learning', 'followUps'],
  training: ['todayOptions', 'adaptation', 'action', 'delta', 'learning', 'followUps', 'mental', 'history'],
  mental: ['mental', 'todayOptions', 'action', 'delta', 'adaptation', 'learning', 'history', 'followUps'],
  review: ['delta', 'learning', 'history', 'adaptation', 'todayOptions', 'mental', 'action', 'followUps'],
};

export const HOME_SURFACE_FOCUS_OPTIONS: Array<{
  value: HomeSurfaceFocus;
  label: string;
  summary: string;
}> = [
  { value: 'balanced', label: 'Standard', summary: 'Pulse-Reihenfolge' },
  { value: 'training', label: 'Training', summary: 'Optionen zuerst' },
  { value: 'mental', label: 'Mental', summary: 'Check-in zuerst' },
  { value: 'review', label: 'Rueckblick', summary: 'Gelerntes zuerst' },
];
