import { useState, useEffect } from 'react';
import { useCreateNutritionLog } from '@/pulse/hooks';
import type { NutritionLogInput } from '@/pulse/api-client';

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

const POWER_CARB_ID = 'mnstry-power-carb-sour-cherry-1-0-8';
const POWER_CARB_CARB_PER_POWDER = 80.8 / 85;

const FUELING_PRODUCTS = [
  { id: POWER_CARB_ID, label: 'POWER CARB Sour Cherry', carbsG: 0 },
  { id: 'mnstry-bicarb-gel-40-lemon-1-0-8', label: 'BICARB GEL 40 Lemon', carbsG: 40 },
  { id: 'mnstry-porridge-bar-sour-cherry', label: 'PORRIDGE BAR Sour Cherry', carbsG: 47 },
  { id: 'mnstry-protein-bar-8-peanut-cranberry', label: 'PROTEIN BAR 8 Peanut & Cranberry', carbsG: 35 },
  { id: 'mars', label: 'Mars', carbsG: 40 },
] as const;

const GI_OPTIONS: Array<{ value: NonNullable<NutritionLogInput['giComfort']>; label: string }> = [
  { value: 'ok', label: 'Magen ok' },
  { value: 'mild_issue', label: 'Magen leicht unruhig' },
  { value: 'issue', label: 'Magenprobleme' },
];

function powderCarbsG(powderG: number): number {
  return Math.round(powderG * POWER_CARB_CARB_PER_POWDER);
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
          aria-label={`${label}${unit ? ` (${unit})` : ''}`}
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
  const [bottles750Ml, setBottles750Ml] = useState(0);
  const [powderG, setPowderG] = useState(0);
  const [fuelingProducts, setFuelingProducts] = useState<string[]>([]);
  const [giComfort, setGiComfort] = useState<NutritionLogInput['giComfort'] | null>(null);
  const [carbs, setCarbs] = useState(0);
  const [notes, setNotes] = useState('');
  const [hasTouchedCarbs, setHasTouchedCarbs] = useState(false);

  const suggestion = suggestedCarbs(activityType, durationMin);
  const hasProductCarbs = fuelingProducts.some(id => {
    const product = FUELING_PRODUCTS.find(item => item.id === id);
    return (product?.carbsG ?? 0) > 0;
  });
  const hasCarbEvidence = hasTouchedCarbs || carbs > 0 || gels > 0 || powderG > 0 || hasProductCarbs;
  const hasRequiredLearningEvidence = giComfort != null && hasCarbEvidence;
  const saveHint = !giComfort
    ? 'GI-Komfort auswaehlen, damit Pulse daraus lernen kann.'
    : !hasCarbEvidence
      ? 'Carbs, Pulver, Gel oder Snack erfassen.'
      : null;

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

  function handleBottlesChange(v: number) {
    setBottles750Ml(v);
    setDrinks(Math.round(v * 750));
  }

  function handlePowderChange(v: number) {
    setPowderG(v);
    if (!hasTouchedCarbs) {
      setCarbs(powderCarbsG(v));
    }
  }

  function toggleProduct(id: string, carbsG: number) {
    const isActive = fuelingProducts.includes(id);
    setFuelingProducts(cur => {
      const active = cur.includes(id);
      return active ? cur.filter(item => item !== id) : [...cur, id];
    });
    if (!hasTouchedCarbs && carbsG > 0 && !isActive) {
      setCarbs(current => current + carbsG);
    }
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
    if (!hasRequiredLearningEvidence) return;
    await create.mutateAsync({
      activityId,
      workoutId: workoutId ?? undefined,
      context: 'during',
      gelsCount: gels || undefined,
      drinksMl: drinks || undefined,
      carbsG: hasCarbEvidence ? carbs : undefined,
      bottles750Ml: bottles750Ml || undefined,
      powderG: powderG || undefined,
      fuelingProducts: fuelingProducts.length > 0 ? fuelingProducts : undefined,
      giComfort: giComfort ?? undefined,
      description: fuelingProducts.length > 0
        ? FUELING_PRODUCTS
            .filter(product => fuelingProducts.includes(product.id))
            .map(product => product.label)
            .join(', ')
        : undefined,
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
            label="750-ml-Flaschen"
            value={bottles750Ml}
            onChange={handleBottlesChange}
            step={1}
            quickAdd={1}
          />

          <NumInput
            label="POWER CARB Pulver"
            value={powderG}
            onChange={handlePowderChange}
            step={10}
            quickAdd={50}
            unit="g"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: -6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              Trinken: {drinks > 0 ? `${drinks} ml` : 'offen'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              Pulver ≈ {powderG > 0 ? `${powderCarbsG(powderG)} g Carbs` : '0 g Carbs'}
            </span>
          </div>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Produkte / Snacks
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FUELING_PRODUCTS.map(product => {
                const active = fuelingProducts.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id, product.carbsG)}
                    style={{
                      minHeight: 34,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 5,
                      background: active ? 'rgba(94,230,207,0.12)' : 'var(--surface-2)',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      padding: '6px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    {product.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Verträglichkeit
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
              {GI_OPTIONS.map(option => {
                const active = giComfort === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGiComfort(option.value)}
                    style={{
                      minHeight: 36,
                      border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                      borderRadius: 5,
                      background: active ? 'rgba(245,158,11,0.12)' : 'var(--surface-2)',
                      color: active ? 'var(--amber)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Notizen (optional)
            </span>
            <textarea
              aria-label="Notizen (optional)"
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
            disabled={create.isPending || !hasRequiredLearningEvidence}
            style={{
              width: '100%', padding: '11px',
              background: 'var(--accent)', color: 'var(--bg)',
              border: 'none', borderRadius: 5,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '.16em', fontWeight: 600,
              cursor: create.isPending || !hasRequiredLearningEvidence ? 'not-allowed' : 'pointer',
              opacity: create.isPending || !hasRequiredLearningEvidence ? 0.55 : 1,
            }}
          >
            {create.isPending ? 'Speichern…' : 'SPEICHERN'}
          </button>

          {saveHint && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.45 }}>
              {saveHint}
            </div>
          )}

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
