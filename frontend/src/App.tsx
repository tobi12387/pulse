import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';

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
import Home from '@/pages/Home';
import Coach from '@/pages/Coach';
import Data from '@/pages/Data';
import Plan from '@/pages/Plan';
import Insights from '@/pages/Insights';
import Settings from '@/pages/Settings';
import ActivityDetail from '@/pages/ActivityDetail';
import Layout from '@/components/Layout';

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
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
