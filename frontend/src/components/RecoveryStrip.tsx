import { usePulseHome } from '@/pulse/hooks';

function pill(color: string, label: string) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 3,
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      letterSpacing: '.12em',
      textTransform: 'uppercase' as const,
      color,
      border: `1px solid ${color}`,
      opacity: 0.85,
    }}>
      {label}
    </span>
  );
}

export function RecoveryStrip() {
  const { data } = usePulseHome();
  const recovery = data?.recovery;
  if (!recovery) return null;

  const { sleepDebt7d, hrvDeviation7d, rhrDrift7d, recoveryScore, recommendation } = recovery;

  const scoreColor =
    recoveryScore >= 80 ? 'var(--green)' :
    recoveryScore >= 65 ? 'var(--accent)' :
    recoveryScore >= 45 ? 'var(--amber)' : 'var(--rose)';

  const scoreLabel =
    recoveryScore >= 80 ? 'OPTIMAL' :
    recoveryScore >= 65 ? 'GUT' :
    recoveryScore >= 45 ? 'MÄSSIG' : 'KRITISCH';

  const sleepColor =
    sleepDebt7d.status === 'ok'     ? 'var(--green)' :
    sleepDebt7d.status === 'mild'   ? 'var(--amber)' : 'var(--rose)';

  const sleepPillLabel =
    sleepDebt7d.status === 'ok' ? 'OK' :
    sleepDebt7d.status === 'mild' ? 'MILD' : 'KRITISCH';

  const hrvColor =
    hrvDeviation7d.status === 'recovering' ? 'var(--green)' :
    hrvDeviation7d.status === 'stable'     ? 'var(--text-2)' : 'var(--rose)';

  const hrvPillLabel =
    hrvDeviation7d.status === 'recovering' ? 'ERHOLUNG' :
    hrvDeviation7d.status === 'stable'     ? 'STABIL' : 'ABFALL';

  const rhrColor = rhrDrift7d.status === 'elevated' ? 'var(--rose)' : 'var(--text-2)';
  const rhrPillLabel = rhrDrift7d.status === 'elevated' ? 'ERHÖHT' : 'NORMAL';

  const rhrValue =
    rhrDrift7d.recent == null || rhrDrift7d.baseline == null
      ? '–'
      : `${rhrDrift7d.bpmAboveBaseline >= 0 ? '+' : ''}${rhrDrift7d.bpmAboveBaseline.toFixed(0)}bpm`;

  const hrvValue =
    `${hrvDeviation7d.pct >= 0 ? '+' : ''}${hrvDeviation7d.pct.toFixed(1)}%`;

  return (
    <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Top row: score + 3 cells */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>

        {/* Score block */}
        <div style={{ minWidth: 72, paddingRight: 14, marginRight: 14, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: scoreColor, lineHeight: 1 }}>
            {recoveryScore}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '.12em' }}>
            /100
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: scoreColor, letterSpacing: '.1em', marginTop: 3 }}>
            {scoreLabel}
          </div>
        </div>

        {/* Three stat cells */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>

          {/* Schlafdefizit */}
          <div style={{ paddingRight: 10, marginRight: 10, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Schlafdefizit
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
              {sleepDebt7d.hours.toFixed(1)}h
            </div>
            {pill(sleepColor, sleepPillLabel)}
          </div>

          {/* HRV-Delta */}
          <div style={{ paddingRight: 10, marginRight: 10, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              HRV-Δ 30d
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
              {hrvValue}
            </div>
            {pill(hrvColor, hrvPillLabel)}
          </div>

          {/* Ruhepuls-Drift */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Ruhepuls-Drift
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
              {rhrValue}
            </div>
            {pill(rhrColor, rhrPillLabel)}
          </div>

        </div>
      </div>

      {/* Recommendation row */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {recommendation}
      </div>
    </div>
  );
}
