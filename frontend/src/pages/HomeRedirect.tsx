import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import SimulationDashboardPage from '@/pages/SimulationDashboardPage';

/**
 * Resolves the `/` route by role: an admin has no simulations of their own,
 * so they land straight on their Proposals inbox (mirrors the existing
 * `/admin` → `/admin/proposals` redirect below in App.tsx); everyone else
 * sees the ordinary Simulation Dashboard, unchanged.
 */
export default function HomeRedirect(): React.ReactElement {
  const role = useAppSelector((s) => s.identity.identity?.role);

  if (role === 'admin') {
    return <Navigate to="/admin/proposals" replace />;
  }

  return <SimulationDashboardPage />;
}
