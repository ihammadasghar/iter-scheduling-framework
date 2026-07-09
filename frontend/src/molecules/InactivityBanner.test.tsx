import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InactivityBanner from './InactivityBanner';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    commitSimulation: vi.fn().mockResolvedValue(undefined),
    sendHeartbeat: vi.fn(),
    createSimulation: vi.fn(),
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    deleteSimulation: vi.fn(),
  },
}));

const makeStore = () =>
  configureStore({ reducer: { session: sessionReducer, class: classReducer } });

const renderBanner = (onDismiss = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <InactivityBanner simId="sim-1" onDismiss={onDismiss} />
    </Provider>,
  );

describe('InactivityBanner', () => {
  it('renders the inactivity warning message', () => {
    renderBanner();
    expect(screen.getByText(/you've been away for a while/i)).toBeInTheDocument();
  });

  it('has a "Save Now" button', () => {
    renderBanner();
    expect(screen.getByRole('button', { name: /save now/i })).toBeInTheDocument();
  });

  it('has a "Dismiss" button', () => {
    renderBanner();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('"Dismiss" button calls onDismiss', () => {
    const onDismiss = vi.fn();
    renderBanner(onDismiss);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('"Save Now" triggers commitSimulation', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /save now/i }));
    expect(vi.mocked(simulationService.simulationService.commitSimulation)).toHaveBeenCalledWith('sim-1');
  });
});
