import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import simulationReducer from '@/store/reducers/simulationSlice';
import SimulationCard from './SimulationCard';

const makeStore = () =>
  configureStore({ reducer: { simulation: simulationReducer } });

const sim = {
  id: 'sim-bob-dead1234',
  branchId: 'sim-bob-dead1234',
  createdAt: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago
};

const renderCard = (props: Partial<React.ComponentProps<typeof SimulationCard>> = {}) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <SimulationCard simulation={sim} {...props} />
      </MemoryRouter>
    </Provider>,
  );

describe('SimulationCard', () => {
  it('does not display the raw simulation ID', () => {
    renderCard();
    expect(screen.queryByText('sim-bob-dead1234')).not.toBeInTheDocument();
  });

  it('shows human-readable time ago', () => {
    renderCard();
    expect(screen.getByText(/draft from/i)).toBeInTheDocument();
  });

  it('shows "No scheduling conflicts" when conflictCount is 0', () => {
    renderCard({ conflictCount: 0 });
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows correct plural conflict message when conflictCount > 1', () => {
    renderCard({ conflictCount: 3 });
    expect(screen.getByText(/3 scheduling conflicts found/i)).toBeInTheDocument();
  });

  it('shows singular conflict message when conflictCount is 1', () => {
    renderCard({ conflictCount: 1 });
    expect(screen.getByText(/1 scheduling conflict found/i)).toBeInTheDocument();
  });

  it('does not show type codes (ROOM_DOUBLE_BOOK etc.) in conflict text', () => {
    renderCard({ conflictCount: 2 });
    expect(screen.queryByText(/ROOM_DOUBLE_BOOK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PROFESSOR_OVERLAP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GROUP_OVERLAP/)).not.toBeInTheDocument();
  });

  it('renders "Open Draft" and "Delete Draft" buttons', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /open draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete draft/i })).toBeInTheDocument();
  });

  it('renders metric chip when metric is provided', () => {
    renderCard({ metric: { name: 'Room Utilisation', value: 82, unit: '%' } });
    expect(screen.getByText(/room utilisation: 82%/i)).toBeInTheDocument();
  });
});
