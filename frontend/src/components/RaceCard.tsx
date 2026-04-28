import { useRaces } from '@/pulse/hooks';
import type { RaceContext } from '@/pulse/api-client';

const PHASE_LABEL: Record<RaceContext['phase'], string> = {
  base:       'BASE',
  build:      'BUILD',
  peak:       'PEAK',
  taper:      'TAPER',
  race_week:  'RACE-WEEK',
  race_day:   'RACE-DAY',
  past:       'VORBEI',
};

const PHASE_COLOR: Record<RaceContext['phase'], string> = {
  base:       'var(--text-2)',
  build:      'var(--blue, #3b82f6)',
  peak:       'var(--amber)',
  taper:      'var(--orange, #f97316)',
  race_week:  'var(--rose)',
  race_day:   'var(--rose)',
  past:       'var(--text-3)',
};

const DISCIPLINE_LABEL: Record<string, string> = {
  run:                'Lauf',
  bike:               'Rad',
  swim:               'Schwimmen',
  triathlon_sprint:   'Triathlon Sprint',
  triathlon_olympic:  'Triathlon Olympisch',
  triathlon_70_3:     'Triathlon 70.3',
  triathlon_140_6:    'Ironman',
  duathlon:           'Duathlon',
  other:              'Sonstiges',
};

function formatTime(sec: number | null): string {
  if (sec == null) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDays(days: number): string {
  if (days === 0)  return 'HEUTE';
  if (days === 1)  return 'morgen';
  if (days < 0)    return `vor ${-days} Tagen`;
  if (days < 14)   return `in ${days} Tagen`;
  if (days < 60)   return `in ${Math.round(days / 7)} Wochen`;
  return `in ${Math.round(days / 30)} Monaten`;
}

export function RaceCard() {
  const { data } = useRaces();
  const races = data?.races ?? [];

  // Show first upcoming, or most recently past
  const next = races.find(r => r.daysUntil >= 0) ?? races[0];
  if (!next) return null;

  const isToday = next.daysUntil === 0;
  const accentColor = isToday ? 'var(--rose)' : PHASE_COLOR[next.phase];

  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden',
      borderColor: accentColor + '66',
      boxShadow: isToday ? `0 0 0 1px ${accentColor}33` : undefined,
    }}>
      <div style={{
        padding: '8px 12px',
        background: isToday ? `${accentColor}15` : 'transparent',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
          color: accentColor, textTransform: 'uppercase',
        }}>
          🏁 {next.priority === 'A' ? 'A-Race' : next.priority === 'B' ? 'B-Race' : 'C-Race'}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: accentColor, letterSpacing: '0.05em',
        }}>
          {PHASE_LABEL[next.phase]}
        </span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
            {next.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {next.discipline ? (DISCIPLINE_LABEL[next.discipline] ?? next.discipline) : 'Disziplin offen'}
            {next.distanceKm ? ` · ${next.distanceKm} km` : ''}
            {next.location ? ` · ${next.location}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              Wann
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {formatDays(next.daysUntil)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
              {next.date}
            </div>
          </div>

          {(next.predictedTimeSec || next.targetTimeSec) && (
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                {next.predictedTimeSec ? 'Prognose' : 'Ziel'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                {formatTime(next.predictedTimeSec ?? next.targetTimeSec)}
              </div>
              {next.predictionConfidence && (
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {next.predictionConfidence === 'high' ? 'sicher' : next.predictionConfidence === 'medium' ? 'okay' : 'unsicher'}
                </div>
              )}
              {!next.predictedTimeSec && next.targetTimeSec && (
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  Zielzeit
                </div>
              )}
            </div>
          )}
        </div>

        {next.predictedTimeSec && next.targetTimeSec && (
          <div style={{
            fontSize: 10, color: 'var(--text-3)',
            padding: '4px 8px', background: 'var(--surface-2)', borderRadius: 'var(--radius)',
          }}>
            Ziel: {formatTime(next.targetTimeSec)}
            {' · '}
            Δ {next.predictedTimeSec > next.targetTimeSec ? '+' : ''}{Math.round((next.predictedTimeSec - next.targetTimeSec) / 60)}min
          </div>
        )}
      </div>
    </div>
  );
}
