import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MiniButton } from '@/components/PulseChrome';
import { pulseApi } from '@/pulse/api-client';
import { pulseKeys, usePulseProfile, useUpdateProfile } from '@/pulse/hooks';
import type { PulseProfileMetricProvenance } from '@coaching-os/shared/pulse';

type SettingsMessage = { text: string; ok: boolean } | null;

type ProfileForm = {
  ftpWatts: string;
  maxHrBpm: string;
  lthrBpm: string;
  vo2max: string;
  weeklyHoursTarget: string;
  trainingPhase: string;
};

const PROFILE_SOURCE_COLOR: Record<string, string> = {
  manual: 'var(--green)',
  garmin_settings: 'var(--accent)',
  activity_derived: 'var(--amber)',
  estimated: 'var(--text-2)',
  missing: 'var(--text-3)',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{children}</span>
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

function ProfileMetricValue({ metric, unit }: { metric?: PulseProfileMetricProvenance; unit?: string }) {
  const color = PROFILE_SOURCE_COLOR[metric?.source ?? 'missing'] ?? 'var(--text-3)';
  const value = metric?.value != null ? `${metric.value}${unit ? ` ${unit}` : ''}` : '–';
  const refreshed = metric?.updatedAt
    ? new Date(metric.updatedAt).toLocaleDateString('de-DE')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 110 }}>
      <Val>{value}</Val>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color,
        textAlign: 'right',
        lineHeight: 1.35,
      }}>
        {metric?.sourceLabel ?? 'Fehlt'}{refreshed ? ` · ${refreshed}` : ''}
      </span>
    </div>
  );
}

export function AthleteProfileCard({ setMessage }: {
  setMessage: (message: SettingsMessage) => void;
}) {
  const qc = useQueryClient();
  const { data: profile } = usePulseProfile();
  const updateProfile = useUpdateProfile();
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);

  function openProfile() {
    setProfileForm({
      ftpWatts: String(profile?.ftpWatts ?? ''),
      maxHrBpm: String(profile?.maxHrBpm ?? ''),
      lthrBpm: String(profile?.lthrBpm ?? ''),
      vo2max: String(profile?.vo2max ?? ''),
      weeklyHoursTarget: String(profile?.weeklyHoursTarget ?? ''),
      trainingPhase: profile?.trainingPhase ?? 'base',
    });
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!profileForm) return;
    const data: Record<string, number | string> = {};
    if (profileForm.ftpWatts) data.ftpWatts = Number(profileForm.ftpWatts);
    if (profileForm.maxHrBpm) data.maxHrBpm = Number(profileForm.maxHrBpm);
    if (profileForm.lthrBpm) data.lthrBpm = Number(profileForm.lthrBpm);
    if (profileForm.vo2max) data.vo2max = Number(profileForm.vo2max);
    if (profileForm.weeklyHoursTarget) data.weeklyHoursTarget = Number(profileForm.weeklyHoursTarget);
    if (profileForm.trainingPhase) data.trainingPhase = profileForm.trainingPhase;
    await updateProfile.mutateAsync(data);
    setProfileForm(null);
    setMessage({ text: 'Profil gespeichert.', ok: true });
  }

  async function handleSyncProfile() {
    setSyncingProfile(true);
    setMessage(null);
    try {
      const res = await pulseApi.garmin.syncProfile();
      await qc.invalidateQueries({ queryKey: pulseKeys.profile });
      const updated = Object.values(res.synced).filter(field => field.status === 'updated');
      const kept = Object.values(res.synced).filter(field => field.status === 'kept_manual');
      const parts = updated.map(field => field.label);
      if (kept.length > 0) parts.push(`${kept.length} manuell behalten`);
      if (res.diagnostics.garminSettings === 'unavailable') parts.push('Garmin-Settings nicht verfügbar');
      setMessage({ text: `Garmin Profil geprüft: ${parts.join(', ') || 'keine neuen Werte'}.`, ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Profil-Sync fehlgeschlagen.', ok: false });
    } finally {
      setSyncingProfile(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="label-mono">Athletenprofil</span>
        {!profileForm && (
          <div style={{ display: 'flex', gap: 6 }}>
            <MiniButton
              onClick={handleSyncProfile}
              disabled={syncingProfile}
              tone="accent"
            >
              {syncingProfile ? '…' : 'Von Garmin'}
            </MiniButton>
            <button
              onClick={openProfile}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                minHeight: 40, padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
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
            FTP, Max-HR + VO2max werden automatisch von Garmin geladen.
          </p>
          {([
            ['FTP (Watt)', 'ftpWatts', 'number'],
            ['Max. Puls (bpm)', 'maxHrBpm', 'number'],
            ['LTHR (bpm)', 'lthrBpm', 'number'],
            ['VO2max', 'vo2max', 'number'],
            ['Wochenstunden', 'weeklyHoursTarget', 'number'],
          ] as [string, keyof ProfileForm, string][]).map(([label, key, type]) => (
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
              {updateProfile.isPending ? 'Speichern…' : 'Speichern'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="FTP">
            <ProfileMetricValue metric={profile?.provenance.fields.ftpWatts} unit="W" />
          </Row>
          <Row label="Max. Puls">
            <ProfileMetricValue metric={profile?.provenance.fields.maxHrBpm} unit="bpm" />
          </Row>
          <Row label="LTHR">
            <ProfileMetricValue metric={profile?.provenance.fields.lthrBpm} unit="bpm" />
          </Row>
          <Row label="VO2max">
            <ProfileMetricValue metric={profile?.provenance.fields.vo2max} />
          </Row>
          <Row label="Wochenstunden">
            <Val>{profile?.weeklyHoursTarget ? `${profile.weeklyHoursTarget} h` : '–'}</Val>
          </Row>
          <Row label="Phase">
            <Pill color="var(--accent)">{(profile?.trainingPhase ?? 'base').toUpperCase()}</Pill>
          </Row>
        </div>
      )}
    </div>
  );
}
