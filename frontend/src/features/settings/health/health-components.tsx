import { useState, type FormEvent } from 'react';
import { InlineFeedback, errorMessage } from '@/components/Feedback';
import { MiniButton } from '@/components/PulseChrome';
import {
  useCreateHealthState,
  useDeleteHealthState,
  useHealthStates,
  useResolveHealthState,
} from '@/pulse/hooks';

type HealthStateForm = {
  type: 'illness' | 'injury' | 'fatigue' | 'travel';
  severity: 'mild' | 'moderate' | 'severe';
  bodyPart: string;
  notes: string;
  durationDays: number;
};

const DEFAULT_HEALTH_FORM: HealthStateForm = {
  type: 'illness',
  severity: 'mild',
  bodyPart: '',
  notes: '',
  durationDays: 3,
};

export function HealthStateCard() {
  const { data } = useHealthStates();
  const create = useCreateHealthState();
  const resolve = useResolveHealthState();
  const remove = useDeleteHealthState();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<HealthStateForm>(DEFAULT_HEALTH_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const active = data?.active ?? [];
  const recent = (data?.recent ?? []).filter(s => s.resolvedAt != null).slice(0, 5);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await create.mutateAsync({
        type: form.type,
        severity: form.severity,
        durationDays: form.durationDays,
        ...(form.bodyPart ? { bodyPart: form.bodyPart } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      });
      setAdding(false);
      setForm(DEFAULT_HEALTH_FORM);
    } catch (err) {
      setCreateError(errorMessage(err, 'Der Gesundheits-Status konnte nicht gespeichert werden.'));
    }
  }

  async function resolveState(id: string) {
    setRowError(null);
    try {
      await resolve.mutateAsync(id);
    } catch (err) {
      setRowError({ id, message: errorMessage(err, 'Der Status konnte nicht erledigt werden.') });
    }
  }

  async function deleteState(id: string) {
    setRowError(null);
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      setRowError({ id, message: errorMessage(err, 'Der Status konnte nicht gelöscht werden.') });
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="label-mono">Gesundheits-Status</span>
        {!adding && (
          <MiniButton
            onClick={() => setAdding(true)}
          >
            + Hinzufügen
          </MiniButton>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        Aktive Status beeinflussen Plan, Risk Watch und Coach-Kontext. Erledigt beendet das Signal; Löschen entfernt es aus der aktiven Bewertung.
      </p>

      {adding && (
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof f.type }))}
              style={{ flex: 1, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            >
              <option value="illness">Krankheit</option>
              <option value="injury">Verletzung</option>
              <option value="fatigue">Erschöpfung</option>
              <option value="travel">Reise</option>
            </select>
            <select
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value as typeof f.severity }))}
              style={{ flex: 1, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            >
              <option value="mild">Leicht</option>
              <option value="moderate">Mittel</option>
              <option value="severe">Schwer</option>
            </select>
          </div>
          {form.type === 'injury' && (
            <input
              placeholder="Körperregion (z.B. knee_left, achilles_right)"
              value={form.bodyPart}
              onChange={e => setForm(f => ({ ...f, bodyPart: e.target.value }))}
              style={{ minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}
            />
          )}
          <input
            placeholder="Notiz (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 8px', fontSize: 12, color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Dauer (Tage)</span>
            <input
              type="number"
              min={1} max={60}
              value={form.durationDays}
              onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
              style={{ width: 70, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={create.isPending}
              style={{ flex: 1, minHeight: 40, background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '8px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {create.isPending ? '…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{ minHeight: 40, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Abbrechen
            </button>
          </div>
          {createError && (
            <InlineFeedback
              title="Gesundheits-Status nicht gespeichert"
              message={createError}
            />
          )}
        </form>
      )}

      {active.length === 0 && !adding && (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Aktuell keine aktiven Status. Plan läuft normal.</p>
      )}

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
              padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', flex: '1 1 140px', minWidth: 0, flexDirection: 'column', gap: 2, fontSize: 12 }}>
                <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em' }}>
                  {s.type.toUpperCase()} / {s.severity}{s.bodyPart ? ` · ${s.bodyPart}` : ''}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                  {s.startDate}{s.endDate ? ` → ${s.endDate}` : ''}
                  {s.notes ? ` · ${s.notes.slice(0, 50)}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { void resolveState(s.id); }}
                  disabled={resolve.isPending}
                  style={{ minHeight: 40, background: 'none', border: '1px solid var(--green)', borderRadius: 3, padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--green)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ERLEDIGT
                </button>
                <button
                  type="button"
                  onClick={() => { void deleteState(s.id); }}
                  disabled={remove.isPending}
                  style={{ minHeight: 40, background: 'none', border: '1px solid var(--text-3)', borderRadius: 3, padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  LÖSCHEN
                </button>
              </div>
              {rowError?.id === s.id && (
                <div style={{ flexBasis: '100%' }}>
                  <InlineFeedback
                    title="Gesundheits-Status nicht aktualisiert"
                    message={rowError.message}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            ZULETZT ERLEDIGT ({recent.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {recent.map(s => (
              <div key={s.id} style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {s.startDate}: {s.type}/{s.severity}{s.bodyPart ? ` (${s.bodyPart})` : ''}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
