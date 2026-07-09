import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer, { setRole } from '@/store/reducers/uiSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import AdminGuard from './AdminGuard';
import TopAppBar from './TopAppBar';

// Minimal store for UI tests
const makeStore = (role: 'user' | 'admin' = 'user') => {
  const store = configureStore({
    reducer: { ui: uiReducer, session: sessionReducer, class: classReducer },
  });
  if (role === 'admin') store.dispatch(setRole('admin'));
  return store;
};

const renderWithRouter = (
  ui: React.ReactElement,
  { initialPath = '/', role = 'user' as 'user' | 'admin' } = {},
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

  it('redirects to / when role is user', () => {
    renderWithRouter(
      <Routes>
        <Route path="/admin/proposals" element={<AdminGuard><div>Admin</div></AdminGuard>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>,
      { initialPath: '/admin/proposals', role: 'user' },
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

describe('TopAppBar', () => {
  it('renders logo text', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByText('UniSchedule')).toBeInTheDocument();
  });

  it('shows "My Simulations" nav link in user view', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByText('My Simulations')).toBeInTheDocument();
  });

  it('does not show admin nav links in user view', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.queryByText('Proposals')).not.toBeInTheDocument();
    expect(screen.queryByText('Rules')).not.toBeInTheDocument();
  });

  it('shows admin nav links in admin view', () => {
    renderWithRouter(<TopAppBar />, { role: 'admin' });
    expect(screen.getByText('Proposals')).toBeInTheDocument();
    expect(screen.getByText('Rules')).toBeInTheDocument();
  });

  it('does not show "My Simulations" in admin view', () => {
    renderWithRouter(<TopAppBar />, { role: 'admin' });
    expect(screen.queryByText('My Simulations')).not.toBeInTheDocument();
  });

  it('shows DEMO ONLY chip', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByText('DEMO ONLY')).toBeInTheDocument();
  });

  it('shows "Switch to Admin View" button in user view', () => {
    renderWithRouter(<TopAppBar />);
    expect(screen.getByRole('button', { name: /switch to admin view/i })).toBeInTheDocument();
  });

  it('shows "Switch to User View" button in admin view', () => {
    renderWithRouter(<TopAppBar />, { role: 'admin' });
    expect(screen.getByRole('button', { name: /switch to user view/i })).toBeInTheDocument();
  });

  it('clicking Switch to Admin View opens confirmation dialog', () => {
    renderWithRouter(<TopAppBar />);
    fireEvent.click(screen.getByRole('button', { name: /switch to admin view/i }));
    expect(screen.getByText(/changes you make here affect the published rules/i)).toBeInTheDocument();
  });

  it('clicking Cancel in dialog closes it without switching role', () => {
    const { store } = renderWithRouter(<TopAppBar />);
    fireEvent.click(screen.getByRole('button', { name: /switch to admin view/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(store.getState().ui.role).toBe('user');
  });

  it('clicking Continue as Admin dispatches setRole(admin)', () => {
    const { store } = renderWithRouter(<TopAppBar />);
    fireEvent.click(screen.getByRole('button', { name: /switch to admin view/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue as admin/i }));
    expect(store.getState().ui.role).toBe('admin');
  });
});
