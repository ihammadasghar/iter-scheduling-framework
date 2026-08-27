import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import identityReducer, { setIdentity } from '@/store/reducers/identitySlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import AdminGuard from './AdminGuard';
import TopAppBar from './TopAppBar';
import type { UserRole } from '@/types';

// Minimal store for UI tests
const makeStore = (role?: UserRole) => {
  const store = configureStore({
    reducer: { identity: identityReducer, session: sessionReducer, class: classReducer },
  });
  if (role !== undefined) {
    store.dispatch(setIdentity({
      role,
      professorId: role === 'professor' ? 'PRF_SMITH' : null,
      studentGroupId: role === 'student' ? 'GRP_BIO_Y1' : null,
    }));
  }
  return store;
};

const renderWithRouter = (
  ui: React.ReactElement,
  { initialPath = '/', role }: { initialPath?: string; role?: UserRole } = {},
) => {
  const store = makeStore(role);
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialPath]}>
          {ui}
        </MemoryRouter>
      </Provider>,
    ),
  };
};

describe('AdminGuard', () => {
  it('renders children when role is admin', () => {
    renderWithRouter(
      <AdminGuard><div>Admin content</div></AdminGuard>,
      { role: 'admin' },
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects to / when role is professor', () => {
    renderWithRouter(
      <Routes>
        <Route path="/admin/proposals" element={<AdminGuard><div>Admin</div></AdminGuard>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>,
      { initialPath: '/admin/proposals', role: 'professor' },
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('redirects to / when no identity has been chosen yet', () => {
    renderWithRouter(
      <Routes>
        <Route path="/admin/proposals" element={<AdminGuard><div>Admin</div></AdminGuard>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>,
      { initialPath: '/admin/proposals' },
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});

describe('TopAppBar', () => {
  it('renders logo text', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByText('ITER')).toBeInTheDocument();
  });

  it('shows "My Simulations" nav link for a professor', () => {
    renderWithRouter(<TopAppBar />, { role: 'professor' });
    expect(screen.getByText('My Simulations')).toBeInTheDocument();
  });

  it('shows "My Simulations" nav link for a student', () => {
    renderWithRouter(<TopAppBar />, { role: 'student' });
    expect(screen.getByText('My Simulations')).toBeInTheDocument();
  });

  it('does not show admin nav links for a professor', () => {
    renderWithRouter(<TopAppBar />, { role: 'professor' });
    expect(screen.queryByText('Proposals')).not.toBeInTheDocument();
    expect(screen.queryByText('Rules')).not.toBeInTheDocument();
  });

  it('shows admin nav links for an admin', () => {
    renderWithRouter(<TopAppBar />, { role: 'admin' });
    expect(screen.getByText('Proposals')).toBeInTheDocument();
    expect(screen.getByText('Rules')).toBeInTheDocument();
  });

  it('does not show "My Simulations" for an admin', () => {
    renderWithRouter(<TopAppBar />, { role: 'admin' });
    expect(screen.queryByText('My Simulations')).not.toBeInTheDocument();
  });

  it('shows no nav links when no identity has been chosen yet', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.queryByText('My Simulations')).not.toBeInTheDocument();
    expect(screen.queryByText('Proposals')).not.toBeInTheDocument();
  });

  it('shows DEMO ONLY chip', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByText('DEMO ONLY')).toBeInTheDocument();
  });

  it('shows a "Change Identity" button', () => {
    renderWithRouter(<TopAppBar />, { role: 'professor' });
    expect(screen.getByRole('button', { name: /change identity/i })).toBeInTheDocument();
  });

  it('clicking "Change Identity" clears the stored identity', () => {
    const { store } = renderWithRouter(<TopAppBar />, { role: 'admin' });
    fireEvent.click(screen.getByRole('button', { name: /change identity/i }));
    expect(store.getState().identity.identity).toBeNull();
  });
});
