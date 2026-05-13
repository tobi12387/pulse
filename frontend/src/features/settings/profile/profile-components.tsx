import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MiniButton } from '@/components/PulseChrome';
import { pulseApi } from '@/pulse/api-client';
import { pulseKeys, usePulseProfile, useUpdateProfile } from '@/pulse/hooks';
import type { PulseFuelingGuidanceStyle, PulseProfileMetricKey, PulseProfileMetricProvenance } from '@coaching-os/shared/pulse';

type SettingsMessage = { text: string; ok: boolean } | null;

type ProfileForm = {
  ftpWatts: string;
  maxHrBpm: string;
  lthrBpm: string;
  vo2max: string;
  weeklyHoursTarget: string;
  trainingPhase: string;
  fuelingEnabled: boolean;
  dietaryConstraints: string;
  preferredFuelingProducts: string;
  carbGuidanceStyle: PulseFuelingGuidanceStyle;
  sodiumGuidanceStyle: PulseFuelingGuidanceStyle;
  bodyWeightGuidanceEnabled: boolean;
};
type ProfileNumericField = 'ftpWatts' | 'maxHrBpm' | 'lthrBpm' | 'vo2max' | 'weeklyHoursTarget';

const PROFILE_SOURCE_COLOR: Record<string, string> = {
  manual: 'var(--green)',
  garmin_settings: 'var(--accent)',
  activity_derived: 'var(--amber)',
  estimated: 'var(--text-2)',
  missing: 'var(--text-3)',
};

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`settings-profile-row${className ? ` ${className}` : ''}`}>
      <span className="settings-profile-row-label">{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: ReactNode }) {
  return (
    <span className="settings-profile-value">{children}</span>
  );
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.1em',
      border: `1px solid ${color}`,
      borderRadius: 3,
      padding: '2px 6px',
      color,
    }}>
      {children}
    </span>
  );
}

function linesToPreferenceList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !['keine', 'keins', 'none', 'no restrictions'].includes(line.toLowerCase()));
}

function guidanceLabel(value: PulseFuelingGuidanceStyle | null | undefined, kind: 'carbs' | 'sodium'): string {
  if (value === 'avoid_amounts') return `${kind === 'carbs' ? 'Carbs' : 'Sodium'}: nur Hinweise`;
  return `${kind === 'carbs' ? 'Carbs' : 'Sodium'}: Pulse schlägt ${kind === 'carbs' ? 'g/h' : 'Bereiche'} vor`;
}

function ProfileMetricValue({ metric, unit }: { metric?: PulseProfileMetricProvenance; unit?: string }) {
  const color = PROFILE_SOURCE_COLOR[metric?.source ?? 'missing'] ?? 'var(--text-3)';
  const value = metric?.value != null ? `${metric.value}${unit ? ` ${unit}` : ''}` : '–';
  const refreshed = metric?.updatedAt
    ? new Date(metric.updatedAt).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="settings-profile-metric-value">
      <Val>{value}</Val>
      <span className="settings-profile-source" style={{ color }}>
        {metric?.sourceLabel ?? 'Fehlt'}{refreshed ? ` · ${refreshed}` : ''}
      </span>
    </div>
  );
}

function ProfileMetricRow({
  label,
  metric,
  unit,
  disabled,
  syncing,
  onAutomatic,
}: {
  label: string;
  metric?: PulseProfileMetricProvenance;
  unit?: string;
  disabled: boolean;
  syncing: boolean;
  onAutomatic: () => void;
}) {
  const isManual = metric?.source === 'manual';

  return (
    <Row label={label} className="settings-profile-row--metric">
      <div className="settings-profile-metric-cell">
        <ProfileMetricValue metric={metric} unit={unit} />
        {isManual && (
          <span className="settings-profile-auto-action">
            <MiniButton
              onClick={onAutomatic}
              disabled={disabled}
              tone="accent"
              ariaLabel={`${label} automatisch übernehmen`}
            >
              {syncing ? '…' : 'Automatisch'}
            </MiniButton>
          </span>
        )}
      </div>
    </Row>
  );
}

export function AthleteProfileCard({ setMessage }: {
  setMessage: (message: SettingsMessage) => void;
}) {
  const qc = useQueryClient();
  const { data: profile } = usePulseProfile();
  const updateProfile = useUpdateProfile();
  const [syncingProfile, setSyncingProfile] = useState<'all' | PulseProfileMetricKey | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  function openProfile() {
    setProfileForm({
      ftpWatts: String(profile?.ftpWatts ?? ''),
      maxHrBpm: String(profile?.maxHrBpm ?? ''),
      lthrBpm: String(profile?.lthrBpm ?? ''),
      vo2max: String(profile?.vo2max ?? ''),
      weeklyHoursTarget: String(profile?.weeklyHoursTarget ?? ''),
      trainingPhase: profile?.trainingPhase ?? 'base',
      fuelingEnabled: profile?.fuelingEnabled ?? true,
      dietaryConstraints: (profile?.dietaryConstraints ?? []).join('\n'),
      preferredFuelingProducts: profile?.preferredFuelingProducts ?? 'Ministry',
      carbGuidanceStyle: profile?.carbGuidanceStyle ?? 'suggest_ranges',
      sodiumGuidanceStyle: profile?.sodiumGuidanceStyle ?? 'suggest_ranges',
      bodyWeightGuidanceEnabled: profile?.bodyWeightGuidanceEnabled ?? true,
    });
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!profileForm) return;
    const data: Record<string, boolean | number | string | string[]> = {};
    if (profileForm.ftpWatts) data.ftpWatts = Number(profileForm.ftpWatts);
    if (profileForm.maxHrBpm) data.maxHrBpm = Number(profileForm.maxHrBpm);
    if (profileForm.lthrBpm) data.lthrBpm = Number(profileForm.lthrBpm);
    if (profileForm.vo2max) data.vo2max = Number(profileForm.vo2max);
    if (profileForm.weeklyHoursTarget) data.weeklyHoursTarget = Number(profileForm.weeklyHoursTarget);
    if (profileForm.trainingPhase) data.trainingPhase = profileForm.trainingPhase;
    data.fuelingEnabled = profileForm.fuelingEnabled;
    data.dietaryConstraints = linesToPreferenceList(profileForm.dietaryConstraints);
    data.preferredFuelingProducts = profileForm.preferredFuelingProducts.trim() || 'Ministry';
    data.carbGuidanceStyle = profileForm.carbGuidanceStyle;
    data.sodiumGuidanceStyle = profileForm.sodiumGuidanceStyle;
    data.bodyWeightGuidanceEnabled = profileForm.bodyWeightGuidanceEnabled;
    await updateProfile.mutateAsync(data);
    setProfileForm(null);
    setMessage({ text: 'Profil gespeichert.', ok: true });
  }

  async function handleSyncProfile(overrideManualFields: PulseProfileMetricKey[] = []) {
    const target = overrideManualFields[0] ?? 'all';
    setSyncingProfile(target);
    setMessage(null);
    try {
      const res = await pulseApi.garmin.syncProfile(
        overrideManualFields.length > 0 ? { overrideManualFields } : undefined,
      );
      await qc.invalidateQueries({ queryKey: pulseKeys.profile });
      const updated = Object.values(res.synced).filter(field => field.status === 'updated');
      const kept = Object.values(res.synced).filter(field => field.status === 'kept_manual');
      const parts = updated.map(field => field.label);
      if (kept.length > 0) parts.push(`${kept.length} manuell geschützt`);
      if (res.diagnostics.garminSettings === 'unavailable') parts.push('Garmin-Settings nicht verfügbar');
      if (overrideManualFields.length > 0 && updated.length === 0) parts.unshift('kein automatischer Wert verfügbar');
      setMessage({ text: `Garmin Profil geprüft: ${parts.join(', ') || 'keine neuen Werte'}.`, ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Profil-Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncingProfile(null);
    }
  }

  return (
    <div className="card settings-profile-card">
      <div className="settings-profile-header">
        <span className="label-mono">Athletenprofil</span>
        {!profileForm && (
          <div className="settings-profile-actions">
            <MiniButton
              onClick={() => void handleSyncProfile()}
              disabled={syncingProfile != null}
              tone="accent"
            >
              {syncingProfile === 'all' ? '…' : 'Garmin prüfen'}
            </MiniButton>
            <button
              onClick={openProfile}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                minWidth: 44, minHeight: 44, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-2)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              Bearbeiten
            </button>
          </div>
        )}
      </div>

      {profileForm ? (
        <form onSubmit={(e) => void handleProfileSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
            Geänderte Werte bleiben manuell geschützt. Automatisch übernimmt den besten Garmin- oder Aktivitätswert.
          </p>
          {([
            ['FTP (Watt)', 'ftpWatts', 'number'],
            ['Max. Puls (bpm)', 'maxHrBpm', 'number'],
            ['LTHR (bpm)', 'lthrBpm', 'number'],
            ['VO2max', 'vo2max', 'number'],
            ['Wochenstunden', 'weeklyHoursTarget', 'number'],
          ] as [string, ProfileNumericField, string][]).map(([label, key, type]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
              <input
                type={type}
                value={profileForm[key]}
                onChange={e => setProfileForm(f => f ? { ...f, [key]: e.target.value } : f)}
                style={{
                  width: 80, background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', minHeight: 40, padding: '5px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                  outline: 'none', textAlign: 'right',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Trainingsphase</span>
            <select
              value={profileForm.trainingPhase}
              onChange={e => setProfileForm(f => f ? { ...f, trainingPhase: e.target.value } : f)}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '5px 8px',
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)',
                outline: 'none',
              }}
            >
              <option value="base">Base</option>
              <option value="build">Build</option>
              <option value="peak">Peak</option>
              <option value="taper">Taper</option>
            </select>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="label-mono">Fueling & Recovery</span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
              Bevorzugte Fueling-Produkte
              <input
                value={profileForm.preferredFuelingProducts}
                onChange={e => setProfileForm(f => f ? { ...f, preferredFuelingProducts: e.target.value } : f)}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', minHeight: 40, padding: '5px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                  outline: 'none',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
              Ernährungseinschränkungen
              <textarea
                value={profileForm.dietaryConstraints}
                onChange={e => setProfileForm(f => f ? { ...f, dietaryConstraints: e.target.value } : f)}
                placeholder="keine"
                rows={2}
                style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', minHeight: 48, padding: '7px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)',
                  outline: 'none', resize: 'vertical',
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={profileForm.fuelingEnabled}
                onChange={e => setProfileForm(f => f ? { ...f, fuelingEnabled: e.target.checked } : f)}
              />
              Fueling-Hinweise aktivieren
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={profileForm.bodyWeightGuidanceEnabled}
                onChange={e => setProfileForm(f => f ? { ...f, bodyWeightGuidanceEnabled: e.target.checked } : f)}
              />
              Körpergewichtsbasierte Hinweise erlauben
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              disabled={updateProfile.isPending}
              style={{
                flex: 1, background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '8px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {updateProfile.isPending ? 'Speichern…' : 'Profil speichern'}
            </button>
            <button
              type="button"
              onClick={() => setProfileForm(null)}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', minHeight: 40, padding: '8px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div className="settings-profile-body">
          <ProfileMetricRow
            label="FTP"
            metric={profile?.provenance.fields.ftpWatts}
            unit="W"
            disabled={syncingProfile != null}
            syncing={syncingProfile === 'ftpWatts'}
            onAutomatic={() => void handleSyncProfile(['ftpWatts'])}
          />
          <ProfileMetricRow
            label="Max. Puls"
            metric={profile?.provenance.fields.maxHrBpm}
            unit="bpm"
            disabled={syncingProfile != null}
            syncing={syncingProfile === 'maxHrBpm'}
            onAutomatic={() => void handleSyncProfile(['maxHrBpm'])}
          />
          <ProfileMetricRow
            label="LTHR"
            metric={profile?.provenance.fields.lthrBpm}
            unit="bpm"
            disabled={syncingProfile != null}
            syncing={syncingProfile === 'lthrBpm'}
            onAutomatic={() => void handleSyncProfile(['lthrBpm'])}
          />
          <ProfileMetricRow
            label="VO2max"
            metric={profile?.provenance.fields.vo2max}
            disabled={syncingProfile != null}
            syncing={syncingProfile === 'vo2max'}
            onAutomatic={() => void handleSyncProfile(['vo2max'])}
          />
          <Row label="Wochenstunden">
            <Val>{profile?.weeklyHoursTarget ? `${profile.weeklyHoursTarget} h` : '–'}</Val>
          </Row>
          <Row label="Phase">
            <Pill color="var(--accent)">{(profile?.trainingPhase ?? 'base').toUpperCase()}</Pill>
          </Row>
          <div className="settings-profile-fueling-block">
            <div className="settings-profile-fueling-heading">
              <div className="settings-profile-fueling-title">
                <span className="label-mono">Fueling & Recovery</span>
                <Pill color={profile?.fuelingEnabled === false ? 'var(--text-3)' : 'var(--green)'}>
                  {profile?.fuelingEnabled === false ? 'AUS' : 'BEREIT'}
                </Pill>
              </div>
              <MiniButton
                onClick={() => setPreferencesOpen(open => !open)}
                ariaLabel={`Fueling & Recovery ${preferencesOpen ? 'ausblenden' : 'anzeigen'}`}
              >
                {preferencesOpen ? 'Ausblenden' : 'Anzeigen'}
              </MiniButton>
            </div>
            <p className="settings-profile-fueling-summary">
              {profile?.preferredFuelingProducts ?? 'Ministry'} · {(profile?.dietaryConstraints ?? []).join(', ') || 'keine Einschränkungen'}
            </p>
            {preferencesOpen && (
              <div className="settings-profile-fueling-details">
                <Row label="Produkte">
                  <Val>{profile?.preferredFuelingProducts ?? 'Ministry'}</Val>
                </Row>
                <Row label="Einschränkungen">
                  <Val>{(profile?.dietaryConstraints ?? []).join(', ') || 'keine'}</Val>
                </Row>
                <Row label="Carbs">
                  <Val>{guidanceLabel(profile?.carbGuidanceStyle, 'carbs')}</Val>
                </Row>
                <Row label="Sodium">
                  <Val>{guidanceLabel(profile?.sodiumGuidanceStyle, 'sodium')}</Val>
                </Row>
                <Row label="Körpergewicht">
                  <Val>{profile?.bodyWeightGuidanceEnabled === false ? 'nicht nutzen' : 'darf genutzt werden'}</Val>
                </Row>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
