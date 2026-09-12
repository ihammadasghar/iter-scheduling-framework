import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OnboardingFlow from './OnboardingFlow';
import identityReducer from '@/store/reducers/identitySlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { RawProfessor, RawStudentGroup } from '@/types';

const PROFESSORS: RawProfessor[] = [
  { id: 'PRF_SMITH', name: 'Dr. Jane Smith', department: 'Biology' },
  { id: 'PRF_JONES', name: 'Prof. Alan Jones', department: 'History' },
];
const STUDENT_GROUPS: RawStudentGroup[] = [
  { id: 'GRP_BIO_Y1', name: 'Biology Year 1', size: 45 },
];

const makeStore = (opts: { hydrated?: boolean; identity?: null; rosterLoading?: boolean } = {}) =>
  configureStore({
    reducer: { identity: identityReducer, schedule: scheduleReducer },
    preloadedState: {
      identity: { identity: opts.identity ?? null, hydrated: opts.hydrated ?? true },
      schedule: {
        rooms: [], courses: [], timeSlots: [],
        professors: PROFESSORS, studentGroups: STUDENT_GROUPS,
        metadata: null, loading: opts.rosterLoading ?? false, error: null,
      },
    },
  });

const renderFlow = (store: ReturnType<typeof makeStore>) =>
  render(
    <Provider store={store}>
      <OnboardingFlow />
    </Provider>,
  );

describe('OnboardingFlow', () => {
  it('renders nothing once identity has not yet been checked (hydrated=false)', () => {
    renderFlow(makeStore({ hydrated: false }));
    expect(screen.queryByText(/who's using iter/i)).not.toBeInTheDocument();
  });

  it('shows the role step once hydrated with no identity', () => {
    renderFlow(makeStore());
    expect(screen.getByText(/who's using iter/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^professor\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^student\b/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scheduling office/i })).toBeInTheDocument();
  });

  it('choosing Admin dispatches setIdentity immediately, with no second step', () => {
    const store = makeStore();
    renderFlow(store);
    userEvent.setup();
    screen.getByRole('button', { name: /^scheduling office/i }).click();
    expect(store.getState().identity.identity).toEqual({
      role: 'admin', professorId: null, studentGroupId: null,
    });
  });

  it('choosing Professor advances to the identity step listing real professor names', async () => {
    const user = userEvent.setup();
    renderFlow(makeStore());
    await user.click(screen.getByRole('button', { name: /^professor\b/i }));

    expect(screen.getByText(/which professor are you/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Professor'));
    expect(await screen.findByRole('option', { name: 'Dr. Jane Smith' })).toBeInTheDocument();
  });

  it('confirming a chosen professor dispatches setIdentity with professorId set', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    renderFlow(store);
    await user.click(screen.getByRole('button', { name: /^professor\b/i }));
    await user.click(screen.getByLabelText('Professor'));
    await user.click(await screen.findByRole('option', { name: 'Dr. Jane Smith' }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(store.getState().identity.identity).toEqual({
      role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null,
    });
  });

  it('confirming a chosen student group dispatches setIdentity with studentGroupId set', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    renderFlow(store);
    await user.click(screen.getByRole('button', { name: /^student\b/i }));
    await user.click(screen.getByLabelText('Student group'));
    await user.click(await screen.findByRole('option', { name: 'Biology Year 1' }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(store.getState().identity.identity).toEqual({
      role: 'student', professorId: null, studentGroupId: 'GRP_BIO_Y1',
    });
  });

  it('Confirm is disabled until an option is chosen', async () => {
    const user = userEvent.setup();
    renderFlow(makeStore());
    await user.click(screen.getByRole('button', { name: /^professor\b/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  it('Back returns to the role step', async () => {
    const user = userEvent.setup();
    renderFlow(makeStore());
    await user.click(screen.getByRole('button', { name: /^professor\b/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/who's using iter/i)).toBeInTheDocument();
  });

  it('renders nothing once an identity has been chosen', () => {
    const store = configureStore({
      reducer: { identity: identityReducer, schedule: scheduleReducer },
      preloadedState: {
        identity: { identity: { role: 'admin' as const, professorId: null, studentGroupId: null }, hydrated: true },
        schedule: { rooms: [], courses: [], timeSlots: [], professors: [], studentGroups: [], metadata: null, loading: false, error: null },
      },
    });
    renderFlow(store);
    expect(screen.queryByText(/who's using iter/i)).not.toBeInTheDocument();
  });
});
