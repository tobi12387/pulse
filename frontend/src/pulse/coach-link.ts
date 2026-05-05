export type CoachPromptFocus = 'daily' | 'plan' | 'data';

export function coachPromptPath(prompt: string, focus: CoachPromptFocus = 'daily'): string {
  const params = new URLSearchParams();
  params.set('focus', focus);
  params.set('prompt', prompt);
  return `/coach?${params.toString()}`;
}
