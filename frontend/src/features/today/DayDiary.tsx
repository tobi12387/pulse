import type { PulseActivity, PulseHomeScreenData, PulsePlannedWorkout } from '@coaching-os/shared/pulse';
import type { ReactNode } from 'react';
import { FCard } from '@/components/ui/focus';
import type { DailyDecision } from '@/pulse/daily-decision';
import { activityLabel } from '@/pulse/activity-labels';

type DayDiaryProps = {
  data: PulseHomeScreenData;
  decision: DailyDecision;
  hasMentalCheckin: boolean;
  latestDeltaTitle?: string | null;
  latestOutcomeTitle?: string | null;
  adaptationSummary?: string | null;
};

function timeLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function todayActivity(data: PulseHomeScreenData): PulseActivity | null {
  const candidates = data.todayActivities?.length
    ? data.todayActivities
    : data.recentActivities.filter(activity => activity.startTime.slice(0, 10) === data.date);
  return candidates.find(activity => (activity.durationSec ?? 0) >= 10 * 60) ?? null;
}

function plannedTodayWorkout(data: PulseHomeScreenData): PulsePlannedWorkout | null {
  if (data.todayWorkout?.plannedDate === data.date) return data.todayWorkout;
  if (data.nextWorkout?.plannedDate === data.date) return data.nextWorkout;
  return null;
}

export function DayDiary({
  data,
  decision,
  hasMentalCheckin,
  latestDeltaTitle,
  latestOutcomeTitle,
  adaptationSummary,
}: DayDiaryProps) {
  const activity = todayActivity(data);
  const planned = plannedTodayWorkout(data);
  const metricSync = data.dataStatus.garmin.lastMetricSyncAt;
  const reviewText = [
    hasMentalCheckin ? 'Mental Check-in ist erledigt.' : 'Mental Check-in ist noch offen.',
    latestDeltaTitle ? `Delta: ${latestDeltaTitle}` : null,
    latestOutcomeTitle ? `Gelernt: ${latestOutcomeTitle}` : null,
    adaptationSummary ? `Planhinweis: ${adaptationSummary}` : null,
  ].filter(Boolean).join(' ');

  return (
    <FCard
      pad="24px 28px"
      testId="focus-day-diary"
      eyebrow="TAGESVERLAUF"
      right={<span className="label-mono" style={{ fontSize: 10 }}>4 EVENTS</span>}
    >
      <DiaryEntry
        time={timeLabel(metricSync, '07:00')}
        eyebrow="MORGEN"
        state="done"
        accent="var(--green)"
        title={data.todayMetrics ? 'Garmin-Sync — Tagesdaten liegen vor.' : 'Garmin-Sync — Datenstatus prüfen.'}
      >
        {data.todayMetrics
          ? `Schlaf ${data.todayMetrics.sleepHours?.toFixed(1) ?? '–'} h, HRV ${data.todayMetrics.hrvRmssd ?? '–'} ms, Ruhepuls ${data.todayMetrics.restingHr ?? '–'} bpm.`
          : 'Heute fehlen noch frische Tagesmetriken; Pulse bleibt bei Empfehlungen vorsichtig.'}
      </DiaryEntry>

      <DiaryEntry
        time="JETZT"
        eyebrow="ENTSCHEIDUNG"
        state="open"
        accent="var(--accent)"
        title={decision.title}
      >
        {decision.reason} {decision.completionCriterion}
      </DiaryEntry>

      <DiaryEntry
        time={activity ? timeLabel(activity.startTime, 'ERLEDIGT') : 'PLAN'}
        eyebrow={activity ? 'EXECUTE · DONE' : planned ? 'EXECUTE · GEPLANT' : 'EXECUTE · FREI'}
        state={activity ? 'done' : planned ? 'planned' : 'open'}
        accent={activity ? 'var(--green)' : planned ? 'var(--amber)' : 'var(--text-3)'}
        title={activity ? `${activity.name?.trim() || activityLabel(activity.activityType)} · erledigt` : planned ? `${activityLabel(planned.activityType)} · Z${planned.zone} · ${planned.durationMin} min` : 'Kein Pflichttraining geplant'}
      >
        {activity
          ? `Garmin hat ${Math.round((activity.durationSec ?? 0) / 60)} min erfasst. ${activity.rpe != null || activity.feedbackLoggedAt ? 'Feedback ist vorhanden.' : 'Feedback ist noch offen.'}`
          : planned
            ? planned.description?.split('\n')[0] ?? 'Geplante Einheit prüfen, ausführen oder bewusst anpassen.'
            : 'Freier Tag heißt nicht automatisch verfügbare Trainingszeit nutzen; die Entscheidung oben bleibt führend.'}
      </DiaryEntry>

      <DiaryEntry
        time="ABEND"
        eyebrow="REVIEW"
        state={hasMentalCheckin ? 'done' : 'open'}
        accent={hasMentalCheckin ? 'var(--green)' : 'var(--text-3)'}
        title="Review + nächster Planabgleich"
      >
        {reviewText || 'Kurzer Check-in, RPE oder Planabgleich schließen den Tag, ohne eine neue Entscheidung auf Home zu öffnen.'}
      </DiaryEntry>
    </FCard>
  );
}

function DiaryEntry({
  time,
  eyebrow,
  state,
  accent,
  title,
  children,
}: {
  time: string;
  eyebrow: string;
  state: 'done' | 'open' | 'planned';
  accent: string;
  title: string;
  children: ReactNode;
}) {
  const stateLabel = state === 'done' ? '● DONE' : `○ ${eyebrow}`;

  return (
    <div className="focus-diary-entry">
      <div style={{ paddingTop: 2 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: state === 'done' ? 'var(--text-2)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: accent, letterSpacing: '.14em', marginTop: 3, textTransform: 'uppercase' }}>
          {stateLabel}
        </div>
      </div>
      <div className="focus-diary-body">
        <div style={{ position: 'absolute', left: -4, top: 6, width: 7, height: 7, borderRadius: 99, background: accent, border: '1px solid var(--bg)' }} />
        <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
