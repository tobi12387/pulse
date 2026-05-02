import { useState, type CSSProperties, type FormEvent } from 'react';
import { useCreateGoal, useDeleteGoal, useUpdateGoal } from '@/pulse/hooks';
import type { GoalCategory, PulseGoal, RaceDiscipline, RacePriority } from '@coaching-os/shared/pulse';

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

const STATUS_COLOR: Record<string, string> = {
  active:    'var(--green)',
  completed: 'var(--blue)',
  paused:    'var(--amber)',
  abandoned: 'var(--rose)',
};

const GOAL_CATEGORIES: { id: GoalCategory; label: string; color: string }[] = [
  { id: 'race',   label: 'Wettkampf', color: 'var(--rose)' },
  { id: 'weight', label: 'Gewicht',   color: 'var(--blue)' },
  { id: 'ftp',    label: 'FTP',       color: 'var(--amber)' },
  { id: 'vo2max', label: 'VO2max',    color: 'var(--green)' },
  { id: 'volume', label: 'Volumen',   color: 'var(--accent)' },
];

const RACE_TYPES = [
  { id: 'ironman',     label: 'Ironman (226km)',           discipline: 'triathlon_140_6',   distanceKm: 226 },
  { id: 'half',        label: '70.3 Half Ironman',          discipline: 'triathlon_70_3',    distanceKm: 113 },
  { id: 'olympic',     label: 'Olympische Distanz',         discipline: 'triathlon_olympic', distanceKm: 51.5 },
  { id: 'sprint',      label: 'Sprint Triathlon',           discipline: 'triathlon_sprint',  distanceKm: 25.75 },
  { id: 'marathon',    label: 'Marathon',                   discipline: 'run',               distanceKm: 42.2 },
  { id: 'half_marathon', label: 'Halbmarathon',             discipline: 'run',               distanceKm: 21.1 },
  { id: '10k',         label: '10 km Lauf',                 discipline: 'run',               distanceKm: 10 },
  { id: '5k',          label: '5 km Lauf',                  discipline: 'run',               distanceKm: 5 },
  { id: 'century',     label: 'Century Ride (160km)',       discipline: 'bike',              distanceKm: 160 },
  { id: 'custom',      label: 'Sonstiges',                  discipline: 'other',             distanceKm: null as number | null },
] as const;

function parseHmsToSec(hms: string): number | undefined {
  const t = hms.trim();
  if (!t) return undefined;
  const parts = t.split(':').map(p => Number(p));
  if (parts.some(p => isNaN(p))) return undefined;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return undefined;
}

const CATEGORY_COLOR: Record<GoalCategory, string> = {
  race: 'var(--rose)', weight: 'var(--blue)', ftp: 'var(--amber)', vo2max: 'var(--green)', volume: 'var(--accent)',
};

type GoalFields = {
  category: GoalCategory; targetDate: string;
  raceType?: string; targetKg?: string; targetFtp?: string; targetVo2max?: string; targetHours?: string; notes?: string;
  racePriority?: RacePriority;
  raceTargetTime?: string;     // H:MM:SS or MM:SS
  raceLocation?: string;
};

type EditableGoal = Pick<PulseGoal,
  'id' | 'title' | 'description' | 'targetDate' | 'status' | 'progress' | 'category' | 'metrics'
  | 'raceDiscipline' | 'raceDistanceKm' | 'raceTargetTimeSec' | 'racePriority' | 'raceLocation' | 'raceNotes'
>;

function buildGoalPayload(fields: GoalFields): {
  title: string; description?: string; targetDate?: string;
  category: GoalCategory; metrics: Record<string, unknown>;
  raceDiscipline?: RaceDiscipline; raceDistanceKm?: number; raceTargetTimeSec?: number;
  racePriority?: RacePriority; raceLocation?: string; raceNotes?: string;
} {
  const { category, targetDate } = fields;
  const metrics: Record<string, unknown> = {};
  let title = '';
  let description: string | undefined;

  if (category === 'race') {
    const race = RACE_TYPES.find(r => r.id === fields.raceType) ?? RACE_TYPES[RACE_TYPES.length - 1]!;
    title = race.label;
    if (fields.notes) description = fields.notes;
    metrics.raceType = fields.raceType;
    const targetSec = fields.raceTargetTime ? parseHmsToSec(fields.raceTargetTime) : undefined;
    return {
      title, description, targetDate: targetDate || undefined, category, metrics,
      raceDiscipline: race.discipline as RaceDiscipline,
      ...(race.distanceKm != null ? { raceDistanceKm: race.distanceKm } : {}),
      ...(targetSec != null     ? { raceTargetTimeSec: targetSec } : {}),
      racePriority: fields.racePriority ?? 'A',
      ...(fields.raceLocation ? { raceLocation: fields.raceLocation } : {}),
      ...(fields.notes        ? { raceNotes: fields.notes } : {}),
    };
  } else if (category === 'weight') {
    title = `Gewicht: ${fields.targetKg} kg`;
    metrics.targetKg = Number(fields.targetKg);
  } else if (category === 'ftp') {
    title = `FTP: ${fields.targetFtp} W`;
    metrics.targetFtp = Number(fields.targetFtp);
  } else if (category === 'vo2max') {
    title = `VO2max: ${fields.targetVo2max} ml/kg/min`;
    metrics.targetVo2max = Number(fields.targetVo2max);
  } else if (category === 'volume') {
    title = `Volumen: ${fields.targetHours} h/Woche`;
    metrics.targetHours = Number(fields.targetHours);
  }

  return { title, description, targetDate: targetDate || undefined, category, metrics };
}

function formatSecToHms(sec: number | null | undefined): string | undefined {
  if (sec == null || !Number.isFinite(sec)) return undefined;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function raceTypeForGoal(goal: Pick<EditableGoal, 'metrics' | 'raceDiscipline' | 'raceDistanceKm'>): string {
  const metricRaceType = typeof goal.metrics?.raceType === 'string' ? goal.metrics.raceType : null;
  if (metricRaceType && RACE_TYPES.some(race => race.id === metricRaceType)) return metricRaceType;

  const match = RACE_TYPES.find(race => {
    if (race.discipline !== goal.raceDiscipline) return false;
    if (race.distanceKm == null || goal.raceDistanceKm == null) return race.distanceKm == null && goal.raceDistanceKm == null;
    return Math.abs(race.distanceKm - goal.raceDistanceKm) < 0.25;
  });

  return match?.id ?? 'custom';
}

const inputStyle = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '7px 10px',
  fontSize: 12, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
};
const labelStyle = { fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

export function GoalForm({ onDone }: { onDone: () => void }) {
  const create = useCreateGoal();
  const [category, setCategory] = useState<GoalCategory>('race');
  const [fields, setFields] = useState<GoalFields>({ category: 'race', targetDate: '', raceType: 'ironman' });

  function set(k: keyof GoalFields, v: string) {
    setFields(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync(buildGoalPayload({ ...fields, category }));
    onDone();
  }

  return (
    <div className="card">
      <div className="label-mono" style={{ marginBottom: 12 }}>Neues Ziel</div>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Category picker */}
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Kategorie</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GOAL_CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setFields(f => ({ ...f, category: cat.id })); }} style={{
                padding: '6px 12px', border: `1px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                borderRadius: 4, background: category === cat.id ? translucent(cat.color, 9) : 'var(--surface)',
                color: category === cat.id ? cat.color : 'var(--text-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', cursor: 'pointer',
              }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category-specific fields */}
        {category === 'race' && (
          <>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Rennen</div>
              <select value={fields.raceType ?? 'ironman'} onChange={e => set('raceType', e.target.value)} style={inputStyle}>
                {RACE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Priorität</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['A','B','C'] as const).map(p => {
                  const desc = p === 'A' ? 'Saisonhöhepunkt · 2w Taper' : p === 'B' ? 'wichtig · 1w Taper' : 'Mitnahme · kein Taper';
                  const active = (fields.racePriority ?? 'A') === p;
                  return (
                    <button key={p} type="button" onClick={() => setFields(f => ({ ...f, racePriority: p }))} title={desc} style={{
                      flex: 1, padding: '6px', border: `1px solid ${active ? 'var(--rose)' : 'var(--border)'}`,
                      borderRadius: 4, background: active ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                      color: active ? 'var(--rose)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer',
                    }}>{p}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                A: 2w Taper · B: 1w Taper · C: kein Taper
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Zielzeit (h:mm:ss, optional)</div>
              <input type="text" value={fields.raceTargetTime ?? ''} onChange={e => set('raceTargetTime', e.target.value)} placeholder="5:15:00 oder 45:00" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Ort (optional)</div>
              <input type="text" value={fields.raceLocation ?? ''} onChange={e => set('raceLocation', e.target.value)} placeholder="z.B. Frankfurt am Main" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: 4 }}>Notiz</div>
              <input type="text" value={fields.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Logistik, Pacing-Plan…" style={inputStyle} />
            </div>
          </>
        )}
        {category === 'weight' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Zielgewicht (kg)</div>
            <input type="number" min={30} max={200} step={0.1} required value={fields.targetKg ?? ''} onChange={e => set('targetKg', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'ftp' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-FTP (Watt)</div>
            <input type="number" min={50} max={600} required value={fields.targetFtp ?? ''} onChange={e => set('targetFtp', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'vo2max' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-VO2max (ml/kg/min)</div>
            <input type="number" min={20} max={90} step={0.1} required value={fields.targetVo2max ?? ''} onChange={e => set('targetVo2max', e.target.value)} style={inputStyle} />
          </div>
        )}
        {category === 'volume' && (
          <div>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-Wochenstunden</div>
            <input type="number" min={1} max={40} step={0.5} required value={fields.targetHours ?? ''} onChange={e => set('targetHours', e.target.value)} style={inputStyle} />
          </div>
        )}

        {/* Date */}
        <div>
          <div style={{ ...labelStyle, marginBottom: 4 }}>Zieldatum</div>
          <input type="date" value={fields.targetDate} onChange={e => set('targetDate', e.target.value)} style={inputStyle} />
        </div>

        <button type="submit" disabled={create.isPending} style={{
          background: 'var(--surface-2)', border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', padding: '9px',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
        }}>
          {create.isPending ? 'Speichern…' : 'Erstellen'}
        </button>
      </form>
    </div>
  );
}

function goalToFields(g: EditableGoal): GoalFields {
  const cat = (g.category ?? 'race') as GoalCategory;
  const m = g.metrics ?? {};
  return {
    category: cat,
    targetDate: g.targetDate ?? '',
    raceType:     cat === 'race'   ? raceTypeForGoal(g) : undefined,
    notes:        cat === 'race'   ? (g.raceNotes ?? g.description ?? undefined) : undefined,
    racePriority: cat === 'race'   ? (g.racePriority ?? 'A') : undefined,
    raceTargetTime: cat === 'race' ? formatSecToHms(g.raceTargetTimeSec) : undefined,
    raceLocation: cat === 'race'   ? (g.raceLocation ?? undefined) : undefined,
    targetKg:     cat === 'weight' ? String(m.targetKg ?? '')        : undefined,
    targetFtp:    cat === 'ftp'    ? String(m.targetFtp ?? '')       : undefined,
    targetVo2max: cat === 'vo2max' ? String(m.targetVo2max ?? '')    : undefined,
    targetHours:  cat === 'volume' ? String(m.targetHours ?? '')     : undefined,
  };
}

function GoalEditForm({ goal, onDone }: { goal: EditableGoal; onDone: () => void }) {
  const update = useUpdateGoal();
  const init = goalToFields(goal);
  const [category, setCategory] = useState<GoalCategory>(init.category);
  const [fields, setFields] = useState<GoalFields>(init);
  const [status, setStatus] = useState(goal.status);

  function set(k: keyof GoalFields, v: string) { setFields(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = buildGoalPayload({ ...fields, category });
    await update.mutateAsync({ id: goal.id, data: { ...payload, status } });
    onDone();
  }

  return (
    <div className="card" style={{ border: `1px solid ${translucent('var(--accent)', 20)}` }}>
      <div className="label-mono" style={{ marginBottom: 12 }}>Ziel bearbeiten</div>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Kategorie</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {GOAL_CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => { setCategory(cat.id); setFields(f => ({ ...f, category: cat.id })); }} style={{
                padding: '6px 12px', border: `1px solid ${category === cat.id ? cat.color : 'var(--border)'}`,
                borderRadius: 4, background: category === cat.id ? translucent(cat.color, 9) : 'var(--surface)',
                color: category === cat.id ? cat.color : 'var(--text-2)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', cursor: 'pointer',
              }}>{cat.label}</button>
            ))}
          </div>
        </div>

        {category === 'race' && (<>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Rennen</div>
            <select value={fields.raceType ?? 'ironman'} onChange={e => set('raceType', e.target.value)} style={inputStyle}>
              {RACE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Priorität</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['A','B','C'] as const).map(p => {
                const desc = p === 'A' ? 'Saisonhöhepunkt · 2w Taper' : p === 'B' ? 'wichtig · 1w Taper' : 'Mitnahme · kein Taper';
                const active = (fields.racePriority ?? 'A') === p;
                return (
                  <button key={p} type="button" onClick={() => setFields(f => ({ ...f, racePriority: p }))} title={desc} style={{
                    flex: 1, padding: '6px', border: `1px solid ${active ? 'var(--rose)' : 'var(--border)'}`,
                    borderRadius: 4, background: active ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                    color: active ? 'var(--rose)' : 'var(--text-2)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer',
                  }}>{p}</button>
                );
              })}
            </div>
          </div>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Zielzeit (h:mm:ss, optional)</div>
            <input type="text" value={fields.raceTargetTime ?? ''} onChange={e => set('raceTargetTime', e.target.value)} placeholder="5:15:00 oder 45:00" style={inputStyle} />
          </div>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ort (optional)</div>
            <input type="text" value={fields.raceLocation ?? ''} onChange={e => set('raceLocation', e.target.value)} placeholder="z.B. Frankfurt am Main" style={inputStyle} />
          </div>
          <div><div style={{ ...labelStyle, marginBottom: 4 }}>Notiz</div>
            <input type="text" value={fields.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Logistik, Pacing-Plan…" style={inputStyle} />
          </div>
        </>)}
        {category === 'weight' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Zielgewicht (kg)</div><input type="number" min={30} max={200} step={0.1} required value={fields.targetKg ?? ''} onChange={e => set('targetKg', e.target.value)} style={inputStyle} /></div>}
        {category === 'ftp'    && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-FTP (Watt)</div><input type="number" min={50} max={600} required value={fields.targetFtp ?? ''} onChange={e => set('targetFtp', e.target.value)} style={inputStyle} /></div>}
        {category === 'vo2max' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-VO2max</div><input type="number" min={20} max={90} step={0.1} required value={fields.targetVo2max ?? ''} onChange={e => set('targetVo2max', e.target.value)} style={inputStyle} /></div>}
        {category === 'volume' && <div><div style={{ ...labelStyle, marginBottom: 4 }}>Ziel-Wochenstunden</div><input type="number" min={1} max={40} step={0.5} required value={fields.targetHours ?? ''} onChange={e => set('targetHours', e.target.value)} style={inputStyle} /></div>}

        <div><div style={{ ...labelStyle, marginBottom: 4 }}>Zieldatum</div>
          <input type="date" value={fields.targetDate} onChange={e => set('targetDate', e.target.value)} style={inputStyle} />
        </div>

        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Status</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['active','paused','completed','abandoned'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)} style={{
                padding: '5px 10px', border: `1px solid ${status === s ? (STATUS_COLOR[s] ?? 'var(--border)') : 'var(--border)'}`,
                borderRadius: 4, background: status === s ? translucent(STATUS_COLOR[s] ?? 'var(--surface)', 13) : 'var(--surface)',
                color: status === s ? (STATUS_COLOR[s] ?? 'var(--text)') : 'var(--text-3)',
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={update.isPending} style={{
            flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)', padding: '9px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
          }}>{update.isPending ? 'Speichern…' : 'Speichern'}</button>
          <button type="button" onClick={onDone} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer',
          }}>Abbrechen</button>
        </div>
      </form>
    </div>
  );
}

const actionBtn: CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '3px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-3)',
};

export function GoalCard({ g }: { g: EditableGoal }) {
  const deleteGoal = useDeleteGoal();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const cat = g.category as GoalCategory | null;
  const catColor = cat ? (CATEGORY_COLOR[cat] ?? 'var(--text-3)') : 'var(--text-3)';
  const statusColor = STATUS_COLOR[g.status] ?? 'var(--text-3)';

  if (editing) return <GoalEditForm goal={g} onDone={() => setEditing(false)} />;

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            {cat && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', color: catColor, background: translucent(catColor, 9), padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase' }}>
                {GOAL_CATEGORIES.find(c => c.id === cat)?.label}
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor }}>● {g.status}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{g.title}</div>
          {g.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{g.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 12 }}>
          <button style={actionBtn} onClick={() => setEditing(true)}>Bearbeiten</button>
          {!confirmDelete
            ? <button style={{ ...actionBtn, color: 'var(--rose)', borderColor: translucent('var(--rose)', 20) }} onClick={() => setConfirmDelete(true)}>Löschen</button>
            : <>
                <button
                  style={{ ...actionBtn, color: 'var(--rose)', borderColor: 'var(--rose)', background: translucent('var(--rose)', 7) }}
                  onClick={() => {
                    setDeleteError(null);
                    deleteGoal.mutate(g.id, {
                      onError: (err) => setDeleteError(err instanceof Error ? err.message : 'Fehler'),
                    });
                  }}
                  disabled={deleteGoal.isPending}
                >
                  {deleteGoal.isPending ? '…' : 'Ja, löschen'}
                </button>
                <button style={actionBtn} onClick={() => setConfirmDelete(false)}>Nein</button>
              </>
          }
        </div>
      </div>
      {deleteError && <div style={{ fontSize: 10, color: 'var(--rose)', marginTop: 2 }}>{deleteError}</div>}

      <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${(g.progress ?? 0) * 100}%`, background: catColor }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
        <span>{Math.round((g.progress ?? 0) * 100)}% abgeschlossen</span>
        {g.targetDate && <span>bis {new Date(g.targetDate + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
      </div>
    </div>
  );
}
