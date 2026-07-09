import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AddMetricDialog from './AddMetricDialog';
import rulesReducer from '@/store/reducers/rulesSlice';
import uiReducer from '@/store/reducers/uiSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import * as rulesService from '@/services/rulesService';

vi.mock('@/services/rulesService', () => ({
  rulesService: {
    getMetricRules: vi.fn().mockResolvedValue([]),
    createMetricRule: vi.fn(),
    deleteMetricRule: vi.fn(),
    getConstraints: vi.fn().mockResolvedValue([]),
    createConstraint: vi.fn(),
    deleteConstraint: vi.fn(),
  },
}));

const makeStore = () =>
  configureStore({
    reducer: {
      rules: rulesReducer, ui: uiReducer, simulation: simulationReducer,
      class: classReducer, conflict: conflictReducer, metric: metricReducer,
      proposal: proposalReducer, session: sessionReducer,
    },
  });

const renderDialog = (onSuccess = vi.fn(), onClose = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <AddMetricDialog open onClose={onClose} onSuccess={onSuccess} />
    </Provider>,
  );

describe('AddMetricDialog', () => {
  it('renders name field and target select', () => {
    renderDialog();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what to measure/i)).toBeInTheDocument();
  });

  it('shows validation error if name is empty on submit', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /add this metric/i }));
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
    );
  });

  it('calls onSuccess after successful submit', async () => {
    vi.mocked(rulesService.rulesService.createMetricRule).mockResolvedValueOnce({
      id: 'new', name: 'Test', target: 'classes', condition: 'count', threshold: 5,
    });
    const onSuccess = vi.fn();
    renderDialog(onSuccess);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'My Rule' } });
    // select condition — need to pick from the dropdown for classes → count
    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this metric/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
