import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import Layout from '@/components/Layout';

const Home = lazy(() => import('@/pages/Home'));
const Coach = lazy(() => import('@/pages/Coach'));
const Data = lazy(() => import('@/pages/Data'));
const Plan = lazy(() => import('@/pages/Plan'));
const Insights = lazy(() => import('@/pages/Insights'));
const Settings = lazy(() => import('@/pages/Settings'));
const ActivityDetail = lazy(() => import('@/pages/ActivityDetail'));
const Login = lazy(() => import('@/pages/Login'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const error = this.state.error as Error;
      const isDev = import.meta.env.DEV;
      return (
        <div style={{ padding: 24, background: '#0a0b0d', minHeight: '100vh', color: '#d8dde5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 'min(520px, 100%)', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 8, background: '#111418', padding: 20 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#f47174', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
              Pulse braucht kurz Hilfe
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 500 }}>
              Diese Ansicht ist gerade abgestürzt.
            </h1>
            <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: '#9098a3' }}>
              Lade die Seite neu. Falls das wieder passiert, bleiben die technischen Details hier für die Fehlersuche verfügbar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 40,
                padding: '8px 12px',
                borderRadius: 5,
                border: '1px solid rgba(94,230,207,0.35)',
                background: 'transparent',
                color: '#5ee6cf',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Neu laden
            </button>
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 10, color: '#9098a3', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Technische Details{isDev ? '' : ' anzeigen'}
              </summary>
              <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 11, color: '#f47174', lineHeight: 1.5 }}>
                {error.message}
              </div>
              {isDev && (
                <pre style={{ marginTop: 10, fontSize: 10, color: '#5c636e', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                  {error.stack}
                </pre>
              )}
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<div className="p-4 text-xs text-[var(--text-3)]">Lädt…</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="coach" element={<Coach />} />
                <Route path="data" element={<Data />} />
                <Route path="plan" element={<Plan />} />
                <Route path="plan/activity/:id" element={<ActivityDetail />} />
                <Route path="insights" element={<Insights />} />
                <Route path="settings" element={<Settings />} />
                <Route path="activity/:id" element={<ActivityDetail />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
