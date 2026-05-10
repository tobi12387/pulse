import { Skeleton } from '@/components/Skeleton';
import { TrainingCapabilityCard } from '@/features/training/TrainingCapabilityCard';
import { ACTIVITY_LABEL } from '@/pulse/activity-labels';
import type { PulsePlanDecision, PulsePlanTrace, PulseRaceCommandSummary, PulseSeasonStrategy } from '@coaching-os/shared/pulse';
import { formatPlanDate } from '../plan-utils';
import { buildPlanDecisionEvidence, type PlanDecisionEvidenceTone } from './plan-decision-insights';

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function TraceInsightBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '9px 10px', background: 'var(--surface)' }}>
      <div className="label-mono" style={{ fontSize: 9, marginBottom: 7, color }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.slice(0, 3).map(item => (
          <span key={item} style={{
            fontSize: 10.5, lineHeight: 1.35, color: 'var(--text-2)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '3px 7px', maxWidth: '100%', overflowWrap: 'anywhere',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const PLAN_DECISION_TONE_COLOR: Record<PlanDecisionEvidenceTone, string> = {
  accent: 'var(--accent)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  rose: 'var(--rose)',
  muted: 'var(--text-3)',
};

export function PlanDecisionCard({
  decision,
  dayLabels,
}: {
  decision: PulsePlanDecision;
  dayLabels: Record<number, string>;
}) {
  const evidence = buildPlanDecisionEvidence(decision);

  return (
    <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Warum diese Woche so?</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', maxWidth: '100%', overflowWrap: 'anywhere' }}>
          {evidence.summary}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {decision.selectedDays.map(day => (
          <span key={`sel-${day}`} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
            border: '1px solid rgba(94,230,207,0.35)', borderRadius: 4, padding: '3px 7px',
          }}>
            {dayLabels[day] ?? day} Training
          </span>
        ))}
        {decision.skippedAvailableDays.map(day => (
          <span key={`skip-${day}`} style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px',
          }}>
            {dayLabels[day] ?? day} bewusst frei
          </span>
        ))}
      </div>

      {evidence.groups.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {evidence.groups.map(group => (
            <div
              key={group.id}
              style={{
                border: `1px solid ${translucent(PLAN_DECISION_TONE_COLOR[group.tone], 28)}`,
                borderRadius: 5,
                padding: '9px 10px',
                background: 'var(--surface)',
              }}
            >
              <div className="label-mono" style={{ fontSize: 9, color: PLAN_DECISION_TONE_COLOR[group.tone], marginBottom: 6 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {group.reasons.slice(0, 2).map(reason => (
                  <p key={reason} style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Keine zusätzlichen Entscheidungsgründe für diese Woche.
        </p>
      )}
    </div>
  );
}

export function PlanTraceCard({ trace, isLoading }: { trace: PulsePlanTrace | null; isLoading: boolean }) {
  if (isLoading && !trace) {
    return (
      <div className="card" style={{ borderColor: 'rgba(94,230,207,0.14)' }}>
        <Skeleton height={10} width="34%" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <Skeleton height={42} />
          <Skeleton height={42} />
          <Skeleton height={42} />
        </div>
      </div>
    );
  }
  if (!trace) return null;

  const sports = Object.entries(trace.sportMix);
  const recentSports = Object.entries(trace.inputSnapshot.recentSportMix);
  const goalNames = trace.inputSnapshot.goals.map(g => g.title);
  const riskTitles = trace.inputSnapshot.riskSignals.map(r => r.title);
  const load = trace.inputSnapshot.load;
  const learning = trace.inputSnapshot.learningSnapshot ?? null;
  const adaptation = trace.adaptation ?? trace.inputSnapshot.adaptation ?? null;
  const restDayRationale = trace.restDayRationale ?? trace.inputSnapshot.restDayRationale ?? [];
  const goalLimiter = trace.inputSnapshot.goalLimiter ?? null;

  return (
    <div className="card" style={{ borderColor: 'rgba(94,230,207,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Einbezogene Daten</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          Woche {trace.weekStart}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8, marginBottom: 12 }}>
        {[
          ['CTL', load.ctl.toFixed(1)],
          ['ATL', load.atl.toFixed(1)],
          ['TSB', load.tsb.toFixed(1)],
          ['Phase', trace.inputSnapshot.phase],
          ['Zielstunden', `${trace.inputSnapshot.weeklyHoursTarget}h`],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 10px', background: 'var(--surface)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 14, color: label === 'TSB' && Number(value) < -12 ? 'var(--amber)' : 'var(--text)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {trace.generatedSummary.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {trace.generatedSummary.map(item => (
            <p key={item} style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{item}</p>
          ))}
        </div>
      )}

      {learning && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginBottom: 12 }}>
          <TraceInsightBlock title="Gelernt aus letzter Woche" items={learning.learnedFromLastWeek} color="var(--green)" />
          <TraceInsightBlock title="Variation" items={learning.variationComparedToLastWeek} color="var(--accent)" />
        </div>
      )}

      {(adaptation || restDayRationale.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginBottom: 12 }}>
          {adaptation && (
            <>
              <TraceInsightBlock title="Gelernt aus Ausführung" items={adaptation.learnedFromExecution} color="var(--green)" />
              <TraceInsightBlock title="Warum ähnlich/anders" items={adaptation.variationRationale} color="var(--accent)" />
            </>
          )}
          <TraceInsightBlock
            title="Freie Tage bewusst"
            items={restDayRationale.map(item => `${item.date}: ${item.reason}`)}
            color="var(--amber)"
          />
        </div>
      )}

      {trace.inputSnapshot.trainingCapabilities && (
        <div style={{ marginBottom: 12 }}>
          <TrainingCapabilityCard summary={trace.inputSnapshot.trainingCapabilities} framed={false} />
        </div>
      )}

      {goalLimiter && (
        <div style={{ marginBottom: 12 }}>
          <TraceInsightBlock
            title={`Limiter · ${goalLimiter.label}`}
            items={[goalLimiter.planBias, ...goalLimiter.evidence.slice(0, 3)]}
            color="var(--amber)"
          />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {(goalNames.length > 0 ? goalNames : ['Kein aktives Ziel']).map(goal => (
          <span key={`goal-${goal}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', border: '1px solid rgba(94,230,207,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Ziel: {goal}
          </span>
        ))}
        {riskTitles.map(title => (
          <span key={`risk-${title}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Risk: {title}
          </span>
        ))}
        {trace.inputSnapshot.healthStates.map(state => (
          <span key={`${state.type}-${state.startDate}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 4, padding: '3px 7px' }}>
            Health: {state.type}{state.bodyPart ? ` · ${state.bodyPart}` : ''}
          </span>
        ))}
        {trace.inputSnapshot.recentRpe.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
            RPE: {trace.inputSnapshot.recentRpe.length} jüngste Bewertung(en)
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Sportmix Plan</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sports.map(([sport, mix]) => (
              <span key={sport} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
                {ACTIVITY_LABEL[sport] ?? sport}: {mix.sessions}x · {mix.totalMinutes}m
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Letzte 6 Wochen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recentSports.length > 0 ? recentSports.map(([sport, mix]) => (
              <span key={sport} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 7px' }}>
                {ACTIVITY_LABEL[sport] ?? sport}: {mix.sessions}x
              </span>
            )) : (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Keine Aktivitätshistorie.</span>
            )}
          </div>
        </div>
        <div>
          <div className="label-mono" style={{ fontSize: 9, marginBottom: 6 }}>Harte Tage</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {trace.hardDays.length > 0 ? trace.hardDays.map(day => (
              <span key={`${day.date}-${day.activityType}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 4, padding: '3px 7px' }}>
                {day.date} · Z{day.zone}
              </span>
            )) : (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Keine Z4/Z5-Reize.</span>
            )}
          </div>
        </div>
      </div>

      {trace.inputSnapshot.dataWarnings.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {trace.inputSnapshot.dataWarnings.map(warning => (
            <p key={warning} style={{ margin: 0, fontSize: 10.5, color: 'var(--amber)', lineHeight: 1.45 }}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const RACE_COMMAND_READINESS_COLOR: Record<PulseRaceCommandSummary['readinessStatus'], string> = {
  ready: 'var(--green)',
  watch: 'var(--amber)',
  compromised: 'var(--rose)',
};

const RACE_COMMAND_RISK_COLOR: Record<PulseRaceCommandSummary['riskImpact']['status'], string> = {
  clear: 'var(--green)',
  watch: 'var(--amber)',
  blocked: 'var(--rose)',
};

const RACE_COMMAND_BOUNDARY_COLOR: Record<PulseRaceCommandSummary['recoveryBoundary']['severity'], string> = {
  normal: 'var(--green)',
  caution: 'var(--amber)',
  hard_stop: 'var(--rose)',
};

function RaceCommandFact({ label, value, detail, color }: { label: string; value: string; detail?: string | null; color: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '9px 10px', background: 'var(--surface)' }}>
      <div className="label-mono" style={{ fontSize: 9, color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>{value}</div>
      {detail && (
        <p style={{ fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.45, margin: '4px 0 0' }}>
          {detail}
        </p>
      )}
    </div>
  );
}

export function RaceCommandCard({ command, isLoading }: { command: PulseRaceCommandSummary | null; isLoading: boolean }) {
  if (isLoading && !command) {
    return (
      <div className="card" style={{ borderColor: 'rgba(244,63,94,0.16)' }}>
        <Skeleton height={10} width="28%" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <Skeleton height={50} />
          <Skeleton height={50} />
          <Skeleton height={50} />
        </div>
      </div>
    );
  }
  if (!command) return null;

  const readinessColor = RACE_COMMAND_READINESS_COLOR[command.readinessStatus];
  const riskColor = RACE_COMMAND_RISK_COLOR[command.riskImpact.status];
  const boundaryColor = RACE_COMMAND_BOUNDARY_COLOR[command.recoveryBoundary.severity];
  const keyWorkout = command.nextKeyWorkout;
  const raceMeta = [
    command.race.date,
    `${command.phase.daysUntil} Tage`,
    command.race.priority + '-Race',
    command.race.location,
  ].filter(Boolean).join(' · ');

  return (
    <div className="card" style={{ borderColor: translucent(readinessColor, 24) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono" style={{ color: 'var(--rose)' }}>Race Command</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: readinessColor }}>
          {command.readinessLabel}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 17, color: 'var(--text)', margin: '0 0 4px', fontWeight: 600 }}>
          {command.race.title}
        </h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {raceMeta}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8, marginBottom: 10 }}>
        <RaceCommandFact
          label="Phase"
          value={command.phase.label}
          detail={command.phase.description}
          color="var(--accent)"
        />
        <RaceCommandFact
          label="Schlüsselreiz"
          value={keyWorkout ? `${formatPlanDate(keyWorkout.plannedDate)} · ${ACTIVITY_LABEL[keyWorkout.activityType] ?? keyWorkout.activityType}` : 'Kein Schlüsselreiz offen'}
          detail={keyWorkout ? `Z${keyWorkout.zone} · ${keyWorkout.durationMin} min${keyWorkout.targetTss ? ` · TSS ${keyWorkout.targetTss}` : ''} · ${keyWorkout.reason}` : 'Der aktuelle Plan erzwingt bis zum Rennen keinen zusätzlichen harten Reiz.'}
          color="var(--amber)"
        />
        <RaceCommandFact
          label={command.recoveryBoundary.label}
          value={command.recoveryBoundary.severity === 'hard_stop' ? 'Stop' : command.recoveryBoundary.severity === 'caution' ? 'Vorsicht' : 'Normal'}
          detail={command.recoveryBoundary.detail}
          color={boundaryColor}
        />
        <RaceCommandFact
          label="Risiko"
          value={command.riskImpact.label}
          detail={command.riskImpact.reasons.slice(0, 2).join(' · ')}
          color={riskColor}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {command.evidence.map(item => (
          <span key={item} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 7px',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SeasonStrategyCard({ strategy, isLoading }: { strategy: PulseSeasonStrategy | null; isLoading: boolean }) {
  if (isLoading && !strategy) {
    return (
      <div className="card" style={{ borderColor: 'rgba(94,230,207,0.16)' }}>
        <Skeleton height={10} width="26%" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <Skeleton height={48} />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </div>
    );
  }
  if (!strategy) return null;

  const guardrails = strategy.guardrails;
  const nextBoundary = guardrails.nextBoundary
    ? `${guardrails.nextBoundary.label} ab ${formatPlanDate(guardrails.nextBoundary.date)}`
    : 'Keine harte Boundary im Horizont';
  const loadModel = (strategy as PulseSeasonStrategy & { loadModel?: PulseSeasonStrategy['loadModel'] }).loadModel ?? null;

  return (
    <div className="card" style={{ borderColor: 'rgba(94,230,207,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Saisonlinie</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {strategy.horizonWeeks} Wochen
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 4px', fontWeight: 600 }}>
          {strategy.currentBlock.label}
          {strategy.primaryGoal ? ` · ${strategy.primaryGoal.title}` : ''}
        </h2>
        <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
          {strategy.currentBlock.focus}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8, marginBottom: 10 }}>
        <RaceCommandFact
          label="Zielwoche"
          value={`${guardrails.targetSessions} Einheiten`}
          detail={guardrails.freeDayRationale}
          color="var(--accent)"
        />
        <RaceCommandFact
          label="Harte Tage"
          value={`max. ${guardrails.maxHardDays}`}
          detail={guardrails.deload ? 'Deload/Konsolidierung aktiv.' : 'Health- und Risk-Regeln bleiben staerker.'}
          color={guardrails.deload ? 'var(--amber)' : 'var(--green)'}
        />
        <RaceCommandFact
          label="Naechste Grenze"
          value={nextBoundary}
          detail={guardrails.rationale.slice(0, 2).join(' ')}
          color="var(--blue)"
        />
        {loadModel && (
          <RaceCommandFact
            label="Saisonlast"
            value={`${loadModel.currentWeek.targetHours}h / ${loadModel.currentWeek.targetTss} TSS`}
            detail={`${loadModel.currentWeek.note} Ramp-Cap ${loadModel.rampRateCapPct}%.`}
            color={loadModel.currentWeek.kind === 'deload' || loadModel.currentWeek.kind === 'taper' ? 'var(--amber)' : 'var(--accent)'}
          />
        )}
      </div>

      {loadModel?.annualTargetHours != null && (
        <div
          data-testid="season-atp-row"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            background: 'var(--surface-2)',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>Jahresziel</span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>
              {loadModel.annualTargetHours} h / {loadModel.annualTargetTss ?? 0} TSS
            </strong>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45, margin: '5px 0 0' }}>
            {loadModel.missedLoadCompensation.capReason}
          </p>
        </div>
      )}

      {loadModel && loadModel.forecast.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
          {loadModel.forecast.slice(0, 4).map(week => (
            <div key={week.weekStart} style={{ background: 'var(--surface-2)', padding: '7px 8px', minWidth: 0 }}>
              <div className="label-mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>{formatPlanDate(week.weekStart)}</div>
              <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>
                {week.kind} · {week.targetTss} TSS
              </div>
            </div>
          ))}
        </div>
      )}

      {loadModel && loadModel.warnings.length > 0 && (
        <div style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
          {loadModel.warnings.slice(0, 2).map(warning => (
            <div key={warning} style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.45 }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {strategy.evidence.map(item => (
          <span key={item} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 7px',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
