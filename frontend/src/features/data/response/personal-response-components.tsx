import type {
  PulsePersonalResponseEvidenceStrength,
  PulsePersonalResponseSignal,
} from '@coaching-os/shared/pulse';
import { usePersonalResponse } from '@/pulse/hooks';

function strengthLabel(strength: PulsePersonalResponseEvidenceStrength): string {
  if (strength === 'useful') return 'nutzbar';
  if (strength === 'learning') return 'lernt';
  return 'offen';
}

function strengthTone(strength: PulsePersonalResponseEvidenceStrength): string {
  if (strength === 'useful') return 'var(--green)';
  if (strength === 'learning') return 'var(--amber)';
  return 'var(--text-3)';
}

function signalLabel(signal: PulsePersonalResponseSignal): string {
  if (signal.kind === 'mental_response') return 'Mental';
  if (signal.kind === 'fueling_response') return 'Fueling';
  if (signal.kind === 'execution_response') return 'Ausführung';
  if (signal.kind === 'load_response') return 'Load';
  return 'Recovery';
}

function PersonalResponseSignalRow({ signal }: { signal: PulsePersonalResponseSignal }) {
  const tone = strengthTone(signal.strength);

  return (
    <div
      data-testid={`personal-response-signal-${signal.kind}`}
      style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 0 0',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{signal.label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: tone, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {signalLabel(signal)} · {strengthLabel(signal.strength)}
        </span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {signal.summary}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--accent)', lineHeight: 1.45 }}>
        {signal.nextAdjustment}
      </p>
    </div>
  );
}

export function PersonalResponseCard({ days = 42 }: { days?: number }) {
  const query = usePersonalResponse(days);
  const summary = query.data?.summary ?? null;
  const tone = summary ? strengthTone(summary.strength) : 'var(--text-3)';

  return (
    <section
      id="data-personal-response"
      className="card"
      data-testid="data-personal-response-card"
      aria-label="Persönliches Reaktionsmodell"
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(245,158,11,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Persönliches Reaktionsmodell
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tone }}>
          {query.isLoading && !summary ? 'lernt aus Daten' : summary ? `${strengthLabel(summary.strength)} · ${summary.range.days}T` : 'nicht verfügbar'}
        </span>
      </div>

      {query.isError ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          Das Reaktionsmodell konnte gerade nicht geladen werden. Die übrigen Analysebereiche bleiben nutzbar.
        </p>
      ) : summary ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            {summary.headline}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.signals.slice(0, 4).map(signal => (
              <PersonalResponseSignalRow key={signal.kind} signal={signal} />
            ))}
          </div>
          {summary.missingEvidence.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Noch offen
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                {summary.missingEvidence.slice(0, 2).join(' ')}
              </p>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[72, 58, 84].map((width) => (
            <div
              key={width}
              style={{ height: 10, width: `${width}%`, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
