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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', fontSize: 12, color: '#f47174', background: '#0a0b0d', minHeight: '100vh' }}>
          <div style={{ marginBottom: 8, color: '#9098a3' }}>RUNTIME ERROR</div>
          <div>{(this.state.error as Error).message}</div>
          <pre style={{ marginTop: 12, fontSize: 10, color: '#5c636e', whiteSpace: 'pre-wrap' }}>{(this.state.error as Error).stack}</pre>
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
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="coach" element={<Coach />} />
                <Route path="data" element={<Data />} />
                <Route path="plan" element={<Plan />} />
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
