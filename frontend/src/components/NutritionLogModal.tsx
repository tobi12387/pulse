import { useState, useEffect } from 'react';
import { useCreateNutritionLog } from '@/pulse/hooks';

interface Props {
  activityId: string;
  workoutId: string | null;
  durationMin: number;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  onClose: () => void;
}

function suggestedCarbs(type: Props['activityType'], durationMin: number): number {
  if (type === 'bike') return durationMin > 60 ? 60 : 30;
  if (type === 'run')  return durationMin > 75 ? 50 : 20;
  return 30;
}

function NumInput({
  label, value, onChange, step = 1, quickAdd, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; quickAdd?: number; unit?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
        {label}{unit ? ` (${unit})` : ''}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - step))}
          style={{
            width: 28, height: 28, borderRadius: 4,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-2)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >−</button>
        <input
          type="number"
          min={0}
          step={step}
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          style={{
            flex: 1, minWidth: 0,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '6px 8px', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => onChange(value + (quickAdd ?? step))}
          style={{
            padding: '0 8px', height: 28, borderRadius: 4,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
            cursor: 'pointer', flexShrink: 0, letterSpacing: '.06em',
          }}
        >+{quickAdd ?? step}</button>
      </div>
    </div>
  );
}

export function NutritionLogModal({ activityId, workoutId, durationMin, activityType, onClose }: Props) {
  const create = useCreateNutritionLog();
  const [gels, setGels]   = useState(0);
  const [drinks, setDrinks] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [notes, setNotes] = useState('');
  const [hasTouchedCarbs, setHasTouchedCarbs] = useState(false);

  const suggestion = suggestedCarbs(activityType, durationMin);

  // Auto-fill carbs from gels if user hasn't touched carbs
  function handleGelsChange(v: number) {
    setGels(v);
    if (!hasTouchedCarbs) {
      setCarbs(v * 25);
    }
  }

  function handleCarbsChange(v: number) {
    setHasTouchedCarbs(true);
    setCarbs(v);
  }

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      activityId,
      workoutId: workoutId ?? undefined,
      context: 'during',
      gelsCount: gels || undefined,
      drinksMl: drinks || undefined,
      carbsG: carbs || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '20px 18px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '.16em' }}>
            FUELING LOG · WÄHREND DEM TRAINING
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-3)',
              lineHeight: 1,
            }}
          >×</button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <NumInput
            label="Gels"
            value={gels}
            onChange={handleGelsChange}
            step={1}
            quickAdd={1}
          />

          <NumInput
            label="Trinken"
            value={drinks}
            onChange={setDrinks}
            step={50}
            quickAdd={250}
            unit="ml"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                Carbs (g)
              </span>
              {!hasTouchedCarbs && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Empfehlung ~{suggestion}g
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleCarbsChange(Math.max(0, carbs - 5))}
                style={{
                  width: 28, height: 28, borderRadius: 4,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-2)',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >−</button>
              <input
                type="number"
                min={0}
                step={5}
                value={carbs === 0 && !hasTouchedCarbs ? '' : carbs}
                placeholder={`~${suggestion}`}
                onChange={e => handleCarbsChange(Math.max(0, Number(e.target.value) || 0))}
                style={{
                  flex: 1, minWidth: 0,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '6px 8px', textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleCarbsChange(carbs + 10)}
                style={{
                  padding: '0 8px', height: 28, borderRadius: 4,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
                  cursor: 'pointer', flexShrink: 0, letterSpacing: '.06em',
                }}
              >+10</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Notizen (optional)
            </span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 200))}
              rows={2}
              maxLength={200}
              placeholder="Gel-Marke, GI-Probleme, ..."
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '8px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                resize: 'none', outline: 'none',
              }}
            />
            {notes.length > 170 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textAlign: 'right' }}>
                {notes.length}/200
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={create.isPending}
            style={{
              width: '100%', padding: '11px',
              background: 'var(--accent)', color: 'var(--bg)',
              border: 'none', borderRadius: 5,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '.16em', fontWeight: 600, cursor: 'pointer',
              opacity: create.isPending ? 0.6 : 1,
            }}
          >
            {create.isPending ? 'Speichern…' : 'SPEICHERN'}
          </button>

          {create.isError && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)', textAlign: 'center' }}>
              Fehler: {(create.error as Error)?.message ?? 'Unbekannt'}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
