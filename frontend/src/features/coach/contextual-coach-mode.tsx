import type {
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulseSeasonStrategyResponse,
} from '@coaching-os/shared/pulse';
import { buildContextualCoachPrompt } from './contextual-coach-prompt';

type ContextualCoachModeCardProps = {
  personalResponse: PulsePersonalResponseResponse | null;
  goalProjection: PulseGoalProjectionResponse | null;
  seasonStrategy: PulseSeasonStrategyResponse | null;
  isLoading: boolean;
  onPrompt: (prompt: string) => void;
};

function statusLabel(status: string | null | undefined): string {
  if (status === 'on_track') return 'auf Kurs';
  if (status === 'watch') return 'beobachten';
  if (status === 'at_risk') return 'kritisch';
  return 'Evidenz offen';
}

function statusColor(status: string | null | undefined): string {
  if (status === 'on_track') return 'var(--green)';
  if (status === 'watch') return 'var(--amber)';
  if (status === 'at_risk') return 'var(--rose)';
  return 'var(--text-3)';
}

function compactText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function ContextFact({
  label,
  value,
  detail,
  color = 'var(--accent)',
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
}) {
  return (
    <div style={{
      minWidth: 0,
      padding: '9px 10px',
      border: '1px solid var(--border)',
      borderRadius: 5,
      background: 'var(--surface-2)',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-3)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, color, fontWeight: 650, lineHeight: 1.35 }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.4, marginTop: 4 }}>
        {detail}
      </div>
    </div>
  );
}

export function ContextualCoachModeCard({
  personalResponse,
  goalProjection,
  seasonStrategy,
  isLoading,
  onPrompt,
}: ContextualCoachModeCardProps) {
  const personalSignal = personalResponse?.summary.signals.find(signal => signal.strength !== 'insufficient')
    ?? personalResponse?.summary.signals[0]
    ?? null;
  const topGoal = goalProjection?.projections[0] ?? null;
  const strategy = seasonStrategy?.strategy ?? null;
  const guardrails = strategy?.guardrails ?? null;

  if (isLoading && !personalResponse && !goalProjection && !seasonStrategy) {
    return (
      <div className="card" data-testid="coach-contextual-mode-card" style={{ padding: '12px 14px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Coach-Kontext
        </span>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '8px 0 0' }}>
          Kontext wird geladen...
        </p>
      </div>
    );
  }

  if (!personalResponse && !goalProjection && !seasonStrategy) return null;

  const evidence = [
    ...(personalSignal?.evidence.slice(0, 2) ?? []),
    ...(topGoal?.evidence.slice(0, 2) ?? []),
    ...(strategy?.evidence.slice(0, 1) ?? []),
    ...(personalResponse?.summary.missingEvidence.slice(0, 1) ?? []),
    ...(goalProjection?.missingEvidence.slice(0, 1) ?? []),
  ].filter((item, index, all) => all.indexOf(item) === index).slice(0, 5);

  return (
    <div
      className="card"
      data-testid="coach-contextual-mode-card"
      style={{ borderColor: 'rgba(94,230,207,0.18)', padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Coach-Kontext
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor(topGoal?.status) }}>
          {topGoal ? `${statusLabel(topGoal.status)} · ${topGoal.probabilityPct ?? 'offen'}%` : 'read-only'}
        </span>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, margin: '0 0 10px' }}>
        Der Coach startet nicht mit einer Standardfrage, sondern mit den Signalen, die gerade wirklich tragen.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 8 }}>
        <ContextFact
          label="Persoenliche Reaktion"
          value={compactText(personalResponse?.summary.headline, 'Reaktionsmuster offen')}
          detail={personalSignal ? personalSignal.nextAdjustment : 'Noch keine belastbare Einzelspur.'}
        />
        <ContextFact
          label="Ziel-Fokus"
          value={compactText(topGoal?.title, 'Zielprojektion offen')}
          detail={topGoal?.nextBestIntervention.title ?? topGoal?.limiterRisk.summary ?? 'Naechste Intervention noch offen.'}
          color={statusColor(topGoal?.status)}
        />
        <ContextFact
          label="Saisonvertrag"
          value={strategy ? strategy.currentBlock.label : 'Saisonlinie offen'}
          detail={guardrails ? `${guardrails.targetSessions} Einheiten, max. ${guardrails.maxHardDays} harte Tage.` : 'Guardrails werden aus Plan gelesen.'}
          color="var(--blue)"
        />
      </div>

      {topGoal?.nextBestIntervention && (
        <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, margin: '9px 0 0' }}>
          <strong style={{ color: 'var(--text)' }}>{topGoal.nextBestIntervention.title}</strong>
          {' '}
          {topGoal.nextBestIntervention.summary}
        </p>
      )}

      {evidence.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
          {evidence.map(item => (
            <span key={item} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 6px',
            }}>
              {item}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onPrompt(buildContextualCoachPrompt({ personalResponse, goalProjection, seasonStrategy }))}
        style={{
          width: '100%',
          minHeight: 42,
          marginTop: 10,
          padding: '9px 10px',
          background: 'rgba(94,230,207,0.12)',
          border: '1px solid rgba(94,230,207,0.28)',
          borderRadius: 5,
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Mit Kontext fragen
      </button>
    </div>
  );
}
