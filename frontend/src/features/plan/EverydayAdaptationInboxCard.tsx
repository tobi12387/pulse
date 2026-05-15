type EverydayAdaptationIntent = {
  id: string;
  title: string;
  summary: string;
  resultPreview: string;
  cta: string;
  targetPath: string;
};

type Props = {
  onNavigate: (path: string) => void;
  offPlanActivityContext?: {
    activityName: string | null;
    activityTypeLabel: string | null;
    durationMin: number | null;
  } | null;
};

function scenarioPath(params: Record<string, string>): string {
  const search = new URLSearchParams({ tab: 'training', source: 'everyday-adaptation', ...params });
  return `/plan?${search.toString()}#plan-scenario-preview`;
}

const intents: EverydayAdaptationIntent[] = [
  {
    id: 'less-time',
    title: 'Weniger Zeit',
    summary: 'Heute passt nur ein kleines Zeitfenster.',
    resultPreview: 'Pulse prüft eine kurze Z1-Option gegen Woche, Recovery und Garmin, bevor etwas gespeichert wird.',
    cta: 'Kurz prüfen',
    targetPath: scenarioPath({
      scenario: 'workout',
      activityType: 'bike',
      zone: '1',
      durationMin: '45',
      description: 'Heute weniger Zeit; Pulse prüft Woche, Recovery und Garmin vor dem Speichern.',
    }),
  },
  {
    id: 'not-ready',
    title: 'Nicht bereit',
    summary: 'Körper, Kopf oder Alltag sprechen gegen den geplanten Reiz.',
    resultPreview: 'Pulse prüft defensivere offene Planlast. Anwenden bleibt ein separater Klick.',
    cta: 'Defensiv prüfen',
    targetPath: scenarioPath({
      scenario: 'reduce_volume',
      description: 'Heute nicht bereit: Pulse prüft defensivere Planlast, bevor Plan oder Garmin betroffen sind.',
    }),
  },
  {
    id: 'done-differently',
    title: 'Anders erledigt',
    summary: 'Du hast schon etwas anderes gemacht oder willst eine Aktivität einordnen.',
    resultPreview: 'Pulse öffnet Aktivitäten und Feedback; Planwirkung entsteht erst aus gespeicherter Evidenz.',
    cta: 'Feedback öffnen',
    targetPath: '/data?tab=activities',
  },
  {
    id: 'skip-today',
    title: 'Heute skippen',
    summary: 'Der intelligenteste Schritt könnte sein, die Einheit bewusst nicht nachzuholen.',
    resultPreview: 'Pulse prüft eine reduzierte Woche und zeigt Garmin-Auswirkung vor jeder Änderung.',
    cta: 'Skip prüfen',
    targetPath: scenarioPath({
      scenario: 'reduce_volume',
      description: 'Heute bewusst auslassen: Pulse prüft reduzierte Woche und Garmin-Auswirkung vor Apply.',
    }),
  },
];

export function EverydayAdaptationInboxCard({ onNavigate, offPlanActivityContext = null }: Props) {
  const offPlanActivityLabel = [
    offPlanActivityContext?.activityName,
    offPlanActivityContext?.durationMin != null ? `${offPlanActivityContext.durationMin} min` : null,
    offPlanActivityContext?.activityTypeLabel,
  ].filter(Boolean).join(' · ');

  return (
    <section
      id="everyday-adaptation-inbox"
      className="card"
      data-testid="everyday-adaptation-inbox"
      tabIndex={-1}
      style={{ borderColor: 'rgba(94,230,207,0.22)', scrollMarginTop: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Heute anders?</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Preview-only</span>
      </div>
      {offPlanActivityContext && (
        <div
          data-testid="plan-offplan-activity-context"
          style={{
            border: '1px solid rgba(94,230,207,0.28)',
            borderRadius: 5,
            background: 'rgba(94,230,207,0.055)',
            padding: '10px 11px',
            marginBottom: 11,
            display: 'grid',
            gap: 5,
          }}
        >
          <div className="label-mono" style={{ color: 'var(--accent)', fontSize: 9 }}>
            Off-plan-Aktivität einordnen
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
            {offPlanActivityLabel || 'Garmin-Aktivität'} erst als Evidence schließen.
          </div>
          <p style={{ margin: 0, fontSize: 11.4, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Fueling und Feedback erklären jetzt, was wirklich passiert ist. Plan und Garmin bleiben unverändert,
            bis du die Planwirkung bewusst prüfst.
          </p>
          <p style={{ margin: 0, fontSize: 11.4, color: 'var(--text-3)', lineHeight: 1.45 }}>
            Nächster ruhiger Schritt: Anders erledigt öffnet die Aktivitäten- und Feedback-Spur, damit der Restplan aus gespeicherter Evidenz reagiert.
          </p>
        </div>
      )}
      <h2 style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
        Alltag erst prüfen, dann Plan schreiben
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Wenn Zeit, Bereitschaft oder Ausführung heute anders sind, führt Pulse dich in eine Vorschau oder Feedback-Spur. Kein Klick hier schreibt direkt in Plan oder Garmin.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 12 }}>
        {intents.map(intent => (
          <div key={intent.id} style={{ border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface-2)', padding: '10px 11px', display: 'grid', gap: 8 }}>
            <div>
              <div className="label-mono" style={{ color: 'var(--accent)', fontSize: 9, marginBottom: 5 }}>
                {intent.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>
                {intent.summary}
              </div>
              <div style={{ fontSize: 11.3, color: 'var(--text-3)', lineHeight: 1.45, marginTop: 5 }}>
                Nach dem Klick: {intent.resultPreview}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(intent.targetPath)}
              style={{
                minHeight: 44,
                minWidth: 44,
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 0,
                padding: '8px 10px',
                textTransform: 'uppercase',
              }}
            >
              {intent.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
