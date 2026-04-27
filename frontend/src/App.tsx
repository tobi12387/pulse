import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  );
}
