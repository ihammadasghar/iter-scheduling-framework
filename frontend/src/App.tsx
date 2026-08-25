import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from '@/store/store';
import theme from '@/styles/theme';
import GlobalStyles from '@/styles/GlobalStyles';
import GlobalErrorSnackbar from '@/atoms/GlobalErrorSnackbar';
import GlobalProposalStatusSnackbar from '@/atoms/GlobalProposalStatusSnackbar';
import AdminGuard from '@/organisms/AdminGuard';
import SimulationDashboardPage from '@/pages/SimulationDashboardPage';
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
          {/* Each page wraps itself in AppShell (see templates/AppShell.tsx) — don't
              also wrap Routes here, or the top app bar renders twice, stacked. */}
          <Routes>
            {/* User routes */}
            <Route path="/" element={<SimulationDashboardPage />} />
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
