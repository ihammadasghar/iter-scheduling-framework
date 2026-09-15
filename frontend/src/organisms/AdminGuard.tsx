import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';

interface AdminGuardProps {
  readonly children: React.ReactNode;
}

/**
 * Redirects non-admin users away from admin-only routes.
 * Renders children only when the onboarded identity's role is 'admin'.
 *
 * Waits for `identity.hydrated` before deciding, same convention as
 * OnboardingFlow — otherwise a hard reload/deep link into an /admin/**
 * route reads `role` as undefined during the brief pre-hydration window and
 * fires a `replace` redirect to `/`, permanently dropping any `:id` in the
 * path before hydration ever gets a chance to confirm the role is admin.
 */
export default function AdminGuard({ children }: AdminGuardProps): React.ReactElement | null {
  const identity = useAppSelector((state) => state.identity.identity);
  const hydrated = useAppSelector((state) => state.identity.hydrated);

  if (!hydrated) {
    return null;
  }

  if (identity?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
