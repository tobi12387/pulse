import { describe, expect, it } from 'vitest';
import { buildSupportSession } from './support-session-library.js';

describe('support-session-library', () => {
  it('creates a short cycling prehab session with concrete blocks', () => {
    const session = buildSupportSession({ focus: 'cycling_prehab', durationMin: 25, fatigue: 'normal' });

    expect(session.title).toBe('Cycling Prehab 25');
    expect(session.blocks.map(block => block.label)).toEqual(['Mobility', 'Core', 'Glutes', 'Cooldown']);
    expect(session.description).toContain('kein Zusatzstress');
  });

  it('downshifts when fatigue is high', () => {
    const session = buildSupportSession({ focus: 'mobility_only', durationMin: 15, fatigue: 'high' });

    expect(session.blocks.every(block => block.intensity === 'easy')).toBe(true);
    expect(session.planNote).toContain('Recovery');
  });
});
