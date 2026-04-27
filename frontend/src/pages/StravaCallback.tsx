import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pulseApi } from '@/pulse/api-client';

export default function StravaCallback() {
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error || !code || !state) {
      navigate(`/settings?strava=error&msg=${encodeURIComponent(error ?? 'missing_params')}`, { replace: true });
      return;
    }

    pulseApi.strava.exchange(code, state)
      .then(() => navigate('/settings?strava=connected', { replace: true }))
      .catch((err: Error) => navigate(`/settings?strava=error&msg=${encodeURIComponent(err.message)}`, { replace: true }));
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.14em' }}>
        STRAVA VERBINDEN…
      </div>
      <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}
