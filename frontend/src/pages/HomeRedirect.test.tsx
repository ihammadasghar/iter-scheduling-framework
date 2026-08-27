import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import HomeRedirect from './HomeRedirect';
import identityReducer from '@/store/reducers/identitySlice';
import type { Identity } from '@/types';

// SimulationDashboardPage pulls in a lot of unrelated slices/services —
// stub it out so this test is only about the redirect decision itself.
vi.mock('@/pages/SimulationDashboardPage', () => ({
  default: () => <div>Simulation Dashboard Content</div>,
}));

const makeStore = (identity: Identity | null) =>
  configureStore({
    reducer: { identity: identityReducer },
    preloadedState: { identity: { identity, hydrated: true } },
  });

const renderAt = (identity: Identity | null) =>
  render(
    <Provider store={makeStore(identity)}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/admin/proposals" element={<div>Proposals Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('HomeRedirect', () => {
  it('redirects an admin to /admin/proposals', () => {
    renderAt({ role: 'admin', professorId: null, studentGroupId: null });
    expect(screen.getByText('Proposals Page')).toBeInTheDocument();
    expect(screen.queryByText('Simulation Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders the Simulation Dashboard for a professor', () => {
    renderAt({ role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null });
    expect(screen.getByText('Simulation Dashboard Content')).toBeInTheDocument();
  });

  it('renders the Simulation Dashboard for a student', () => {
    renderAt({ role: 'student', professorId: null, studentGroupId: 'GRP_BIO_Y1' });
    expect(screen.getByText('Simulation Dashboard Content')).toBeInTheDocument();
  });

  it('renders the Simulation Dashboard when no identity is set', () => {
    renderAt(null);
    expect(screen.getByText('Simulation Dashboard Content')).toBeInTheDocument();
  });
});
