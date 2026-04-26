import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

const HomeScreen     = lazy(() => import('@/pages/pulse/HomeScreen'));
const CoachScreen    = lazy(() => import('@/pages/pulse/CoachScreen'));
const SleepScreen    = lazy(() => import('@/pages/pulse/SleepScreen'));
const TrainingScreen = lazy(() => import('@/pages/pulse/TrainingScreen'));
const MentalScreen   = lazy(() => import('@/pages/pulse/MentalScreen'));
const CalendarScreen = lazy(() => import('@/pages/pulse/CalendarScreen'));
const GoalsScreen    = lazy(() => import('@/pages/pulse/GoalsScreen'));
const ReviewScreen   = lazy(() => import('@/pages/pulse/ReviewScreen'));

const PULSE_TABS = [
  { to: '',       label: 'Home',    end: true  },
  { to: 'coach',  label: 'Coach',   end: false },
  { to: 'sleep',  label: 'Schlaf',  end: false },
  { to: 'train',  label: 'Training',end: false },
  { to: 'mental', label: 'Mental',  end: false },
  { to: 'goals',  label: 'Ziele',   end: false },
  { to: 'review', label: 'Review',  end: false },
];

export function PulseRouter() {
  return (
    <div className="space-y-3">
      {/* Sub-navigation */}
      <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {PULSE_TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            relative="path"
            className={({ isActive }) =>
              `whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={<div className="text-muted-foreground text-sm py-4">Lade…</div>}>
        <Routes>
          <Route index         element={<HomeScreen />} />
          <Route path="coach"  element={<CoachScreen />} />
          <Route path="sleep"  element={<SleepScreen />} />
          <Route path="train"  element={<TrainingScreen />} />
          <Route path="mental" element={<MentalScreen />} />
          <Route path="cal"    element={<CalendarScreen />} />
          <Route path="goals"  element={<GoalsScreen />} />
          <Route path="review" element={<ReviewScreen />} />
        </Routes>
      </Suspense>
    </div>
  );
}
