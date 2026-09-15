import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AdminGuard from './AdminGuard';
import identityReducer from '@/store/reducers/identitySlice';
import type { Identity } from '@/types';

const makeStore = (identity: Identity | null, hydrated: boolean) =>
  configureStore({
    reducer: { identity: identityReducer },
    preloadedState: { identity: { identity, hydrated } },
  });

const renderAt = (identity: Identity | null, hydrated: boolean) =>
  render(
    <Provider store={makeStore(identity, hydrated)}>
      <MemoryRouter initialEntries={['/admin/proposals/PR_1']}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/admin/proposals/:id"
            element={
              <AdminGuard>
                <div>Admin Content</div>
              </AdminGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('AdminGuard', () => {
  it('renders nothing (no redirect) while identity has not yet hydrated', () => {
    const { container } = renderAt(null, false);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects to / once hydrated with a non-admin identity', () => {
    renderAt({ role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null }, true);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('redirects to / once hydrated with no identity', () => {
    renderAt(null, true);
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('renders children once hydrated with an admin identity', () => {
    renderAt({ role: 'admin', professorId: null, studentGroupId: null }, true);
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });
});
