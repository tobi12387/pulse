import { useMemo, useState, type FormEvent } from 'react';
import {
  useCreateEquipment,
  useEquipment,
  useRetireEquipment,
  useSetEquipmentDefault,
} from '@/pulse/hooks';
import type { EquipmentCategory, PulseActivityType, PulseEquipment } from '@coaching-os/shared/pulse';

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

const ACTIVITY_TYPES: PulseActivityType[] = ['run', 'bike', 'swim', 'strength', 'hike', 'other'];

const ACTIVITY_LABEL: Record<PulseActivityType, string> = {
  run: 'Laufen',
  bike: 'Rad',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Wandern',
  other: 'Sonstiges',
};

const DEFAULT_ACTIVITY_TYPES: PulseActivityType[] = ['bike', 'run', 'swim', 'hike'];
const PARENTABLE_CATEGORIES: EquipmentCategory[] = ['chain', 'tire', 'brake_pad', 'cassette'];

const CATEGORY_OPTIONS: Array<{ id: EquipmentCategory; label: string; defaultTypes: PulseActivityType[]; retirementKm: number | '' }> = [
  { id: 'bike', label: 'Bike', defaultTypes: ['bike'], retirementKm: '' },
  { id: 'chain', label: 'Kette', defaultTypes: ['bike'], retirementKm: 3500 },
  { id: 'tire', label: 'Reifen', defaultTypes: ['bike'], retirementKm: 5000 },
  { id: 'brake_pad', label: 'Bremsbeläge', defaultTypes: ['bike'], retirementKm: 2000 },
  { id: 'cassette', label: 'Kassette', defaultTypes: ['bike'], retirementKm: 8000 },
  { id: 'running_shoe', label: 'Laufschuhe', defaultTypes: ['run'], retirementKm: 700 },
  { id: 'wetsuit', label: 'Wetsuit', defaultTypes: ['swim'], retirementKm: '' },
  { id: 'other', label: 'Sonstiges', defaultTypes: ['other'], retirementKm: '' },
];

const CATEGORY_LABEL: Record<EquipmentCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map(option => [option.id, option.label]),
) as Record<EquipmentCategory, string>;

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyForm() {
  return {
    name: '',
    category: 'bike' as EquipmentCategory,
    parentEquipmentId: '',
    activityTypes: ['bike'] as PulseActivityType[],
    installedDate: todayLocal(),
    initialKm: '',
    retirementKm: '',
    notes: '',
  };
}

function parseOptionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function EquipmentRow({
  item,
  children,
  onRetire,
  retiring,
}: {
  item: PulseEquipment;
  children: PulseEquipment[];
  onRetire: (id: string) => void;
  retiring: boolean;
}) {
  const pct = item.pctConsumed;
  const progress = item.retirementKm && item.retirementKm > 0
    ? Math.min(100, Math.max(2, item.pctConsumed ?? 0))
    : 0;
  const color = item.warning ? 'var(--rose)' : pct != null && pct >= 75 ? 'var(--amber)' : 'var(--accent)';

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              {CATEGORY_LABEL[item.category]}
            </span>
            {item.warning && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--rose)', letterSpacing: '.08em' }}>
                ERSETZEN
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
              {item.totalKm.toFixed(1)} km
              {item.retirementKm ? ` / ${item.retirementKm.toFixed(0)} km` : ''}
            </span>
            {item.activityTypes.map(type => (
              <span key={type} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                {ACTIVITY_LABEL[type]}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRetire(item.id)}
          disabled={retiring}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-3)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            cursor: retiring ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          {retiring ? '…' : 'Ausmustern'}
        </button>
      </div>

      {item.retirementKm && (
        <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: color }} />
        </div>
      )}

      {children.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
          {children.map(child => (
            <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 11, color: child.warning ? 'var(--rose)' : 'var(--text-2)' }}>
                {child.name}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                  {child.totalKm.toFixed(0)}
                  {child.retirementKm ? `/${child.retirementKm.toFixed(0)}` : ''} km
                </span>
                <button
                  type="button"
                  onClick={() => onRetire(child.id)}
                  disabled={retiring}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: retiring ? 'default' : 'pointer', fontSize: 12, lineHeight: 1 }}
                  aria-label={`${child.name} ausmustern`}
                >
                  x
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EquipmentList({ setMessage }: {
  setMessage?: (message: { text: string; ok: boolean } | null) => void;
}) {
  const equipmentQuery = useEquipment();
  const create = useCreateEquipment();
  const retire = useRetireEquipment();
  const setDefault = useSetEquipmentDefault();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const equipment = useMemo(() => equipmentQuery.data?.equipment ?? [], [equipmentQuery.data?.equipment]);
  const defaults = equipmentQuery.data?.defaults ?? [];
  const parentCandidates = equipment.filter(item => !item.retiredAt && item.category === 'bike');
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string, PulseEquipment[]>();
    for (const item of equipment) {
      if (!item.parentEquipmentId) continue;
      const list = grouped.get(item.parentEquipmentId) ?? [];
      list.push(item);
      grouped.set(item.parentEquipmentId, list);
    }
    return grouped;
  }, [equipment]);
  const topLevel = equipment.filter(item => !item.parentEquipmentId);

  function updateCategory(category: EquipmentCategory) {
    const selected = CATEGORY_OPTIONS.find(option => option.id === category)!;
    setForm(f => ({
      ...f,
      category,
      activityTypes: selected.defaultTypes,
      retirementKm: selected.retirementKm === '' ? '' : String(selected.retirementKm),
      parentEquipmentId: PARENTABLE_CATEGORIES.includes(category) ? f.parentEquipmentId : '',
    }));
  }

  function toggleActivity(type: PulseActivityType) {
    setForm(f => {
      const next = f.activityTypes.includes(type)
        ? f.activityTypes.filter(t => t !== type)
        : [...f.activityTypes, type];
      return { ...f, activityTypes: next.length > 0 ? next : f.activityTypes };
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMessage?.(null);
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        parentEquipmentId: form.parentEquipmentId || null,
        activityTypes: form.activityTypes,
        installedDate: form.installedDate,
        initialKm: parseOptionalNumber(form.initialKm),
        retirementKm: parseOptionalNumber(form.retirementKm),
        notes: form.notes.trim() ? form.notes.trim() : null,
      });
      setForm(emptyForm());
      setAdding(false);
      setMessage?.({ text: 'Equipment gespeichert.', ok: true });
    } catch (err) {
      setMessage?.({ text: err instanceof Error ? err.message : 'Equipment konnte nicht gespeichert werden.', ok: false });
    }
  }

  async function handleRetire(id: string) {
    setMessage?.(null);
    try {
      await retire.mutateAsync({ id });
      setMessage?.({ text: 'Equipment ausgemustert.', ok: true });
    } catch (err) {
      setMessage?.({ text: err instanceof Error ? err.message : 'Equipment konnte nicht ausgemustert werden.', ok: false });
    }
  }

  async function handleDefault(activityType: PulseActivityType, equipmentId: string) {
    if (!equipmentId) return;
    setMessage?.(null);
    try {
      await setDefault.mutateAsync({ activityType, equipmentId });
      setMessage?.({ text: `Standard-Equipment für ${ACTIVITY_LABEL[activityType]} gespeichert.`, ok: true });
    } catch (err) {
      setMessage?.({ text: err instanceof Error ? err.message : 'Default konnte nicht gespeichert werden.', ok: false });
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="label-mono">Equipment</span>
        <button
          type="button"
          onClick={() => setAdding(v => !v)}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: adding ? 'var(--rose)' : 'var(--text-2)', cursor: 'pointer',
          }}
        >
          {adding ? 'Schliessen' : '+ Equipment'}
        </button>
      </div>

      {adding && (
        <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Name, z.B. Canyon Aeroad oder Hoka Clifton"
            style={inputStyle}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select
              value={form.category}
              onChange={e => updateCategory(e.target.value as EquipmentCategory)}
              style={inputStyle}
            >
              {CATEGORY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <input
              type="date"
              value={form.installedDate}
              onChange={e => setForm(f => ({ ...f, installedDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          {PARENTABLE_CATEGORIES.includes(form.category) && parentCandidates.length > 0 && (
            <select
              value={form.parentEquipmentId}
              onChange={e => setForm(f => ({ ...f, parentEquipmentId: e.target.value }))}
              style={inputStyle}
            >
              <option value="">Kein Parent</option>
              {parentCandidates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.initialKm}
              onChange={e => setForm(f => ({ ...f, initialKm: e.target.value }))}
              placeholder="Start-km"
              style={inputStyle}
            />
            <input
              type="number"
              min={0}
              step={1}
              value={form.retirementKm}
              onChange={e => setForm(f => ({ ...f, retirementKm: e.target.value }))}
              placeholder="Wechsel bei km"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {ACTIVITY_TYPES.map(type => {
              const active = form.activityTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleActivity(type)}
                  style={{
                    padding: '5px 9px',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 4,
                    background: active ? translucent('var(--accent)', 9) : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '.08em',
                    cursor: 'pointer',
                  }}
                >
                  {ACTIVITY_LABEL[type]}
                </button>
              );
            })}
          </div>
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value.slice(0, 500) }))}
            placeholder="Notiz optional"
            style={inputStyle}
          />
          <button type="submit" disabled={create.isPending || !form.name.trim()} style={submitStyle}>
            {create.isPending ? 'Speichert…' : 'Speichern'}
          </button>
        </form>
      )}

      {equipmentQuery.isLoading ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>Lade Equipment…</p>
      ) : topLevel.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>
          Noch kein Equipment erfasst.
        </p>
      ) : (
        <div>
          {topLevel.map(item => (
            <EquipmentRow
              key={item.id}
              item={item}
              children={childrenByParent.get(item.id) ?? []}
              onRetire={id => void handleRetire(id)}
              retiring={retire.isPending}
            />
          ))}
        </div>
      )}

      {equipment.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <div className="label-mono" style={{ marginBottom: 8 }}>Defaults</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEFAULT_ACTIVITY_TYPES.map(activityType => {
              const options = equipment.filter(item => !item.retiredAt && !item.parentEquipmentId && item.activityTypes.includes(activityType));
              const current = defaults.find(row => row.activityType === activityType)?.equipmentId ?? '';
              return (
                <label key={activityType} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{ACTIVITY_LABEL[activityType]}</span>
                  <select
                    value={current}
                    disabled={options.length === 0 || setDefault.isPending}
                    onChange={e => void handleDefault(activityType, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="" disabled>Kein Default</option>
                    {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '7px 9px',
  color: 'var(--text)',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
} as const;

const submitStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  padding: '9px',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--accent)',
  cursor: 'pointer',
} as const;
