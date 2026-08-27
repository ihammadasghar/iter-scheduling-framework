import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from '@/store/store';
import theme from '@/styles/theme';
import GlobalStyles from '@/styles/GlobalStyles';
import GlobalErrorSnackbar from '@/atoms/GlobalErrorSnackbar';
import GlobalProposalStatusSnackbar from '@/atoms/GlobalProposalStatusSnackbar';
import OnboardingFlow from '@/organisms/OnboardingFlow';
import AdminGuard from '@/organisms/AdminGuard';
import { hydrateIdentity } from '@/store/reducers/identitySlice';
import { fetchPublishedScheduleThunk } from '@/store/reducers/scheduleSlice';
import HomeRedirect from '@/pages/HomeRedirect';
import TimetablePage from '@/pages/TimetablePage';
import PublishedSchedulePage from '@/pages/PublishedSchedulePage';
import ProposalsDashboardPage from '@/pages/ProposalsDashboardPage';
import ProposalReviewPage from '@/pages/ProposalReviewPage';
import RulesPage from '@/pages/RulesPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Root application component.
 * Provides MUI theme, Redux store, React Router, and the app shell.
 */
export default function App(): React.ReactElement {
  // Once, on first load: check localStorage for a previously chosen identity
  // (OnboardingFlow gates the app until this resolves), and load the
  // published roster so the onboarding picker has real professor/student
  // group names to choose from before any simulation exists.
  useEffect(() => {
    store.dispatch(hydrateIdentity());
    void store.dispatch(fetchPublishedScheduleThunk());
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles />
        <BrowserRouter>
          {/* Global error Snackbar — listens to all Redux error fields */}
          <GlobalErrorSnackbar />
          {/* Global proposal-submission-result Snackbar — survives navigating
              away from the submitting page before/as the result arrives */}
          <GlobalProposalStatusSnackbar />
          {/* Gates every route below until an identity (role, and for
              professor/student, who) has been chosen — see identitySlice. */}
          <OnboardingFlow />
          {/* Each page wraps itself in AppShell (see templates/AppShell.tsx) — don't
              also wrap Routes here, or the top app bar renders twice, stacked. */}
          <Routes>
            {/* User routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/simulations/:id" element={<TimetablePage />} />
            <Route path="/schedule" element={<PublishedSchedulePage />} />

            {/* Admin routes — guarded by role check */}
            <Route
              path="/admin/proposals"
              element={
                <AdminGuard>
                  <ProposalsDashboardPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/proposals/:id"
              element={
                <AdminGuard>
                  <ProposalReviewPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/rules"
              element={
                <AdminGuard>
                  <RulesPage />
                </AdminGuard>
              }
            />

            {/* Redirect /admin base to proposals */}
            <Route path="/admin" element={<Navigate to="/admin/proposals" replace />} />

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
}
