import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';

interface AdminGuardProps {
  readonly children: React.ReactNode;
}

/**
 * Redirects non-admin users away from admin-only routes.
 * Renders children only when the onboarded identity's role is 'admin'.
 */
export default function AdminGuard({ children }: AdminGuardProps): React.ReactElement {
  const role = useAppSelector((state) => state.identity.identity?.role);

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
