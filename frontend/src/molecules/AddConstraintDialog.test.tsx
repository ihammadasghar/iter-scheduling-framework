import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import AddConstraintDialog from './AddConstraintDialog';
import type { Constraint } from '@/types';
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
    updateConstraint: vi.fn(),
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
      <IntlProvider locale="en" messages={{}}>
        <AddConstraintDialog open onClose={onClose} onSuccess={onSuccess} />
      </IntlProvider>
    </Provider>,
  );

const EXISTING_CONSTRAINT: Constraint = {
  id: 'constraint-1',
  name: 'No overload',
  target: 'Professor',
  violationCondition: 'consecutive_limit',
  limit: 3,
};

const renderEditDialog = (existingRule: Constraint, onSuccess = vi.fn(), onClose = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <IntlProvider locale="en" messages={{}}>
        <AddConstraintDialog open onClose={onClose} onSuccess={onSuccess} existingRule={existingRule} />
      </IntlProvider>
    </Provider>,
  );

const selectCondition = async (optionNameRegex: RegExp): Promise<void> => {
  fireEvent.mouseDown(screen.getByLabelText(/block proposal when/i));
  await waitFor(() => screen.getByRole('option', { name: optionNameRegex }));
  fireEvent.click(screen.getByRole('option', { name: optionNameRegex }));
  // Wait for the popover to fully close before any follow-up interaction —
  // re-opening the same select immediately after can otherwise race MUI's
  // close transition and momentarily match two "Block proposal when"
  // elements (the closed trigger and the still-unmounting popover).
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
};

describe('AddConstraintDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders name field and target/condition selects', () => {
    renderDialog();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/applies to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/block proposal when/i)).toBeInTheDocument();
  });

  it('shows validation error if name is empty on submit', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /add constraint/i }));
    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument());
  });

  it('does not render a limit field for a structural violation condition', async () => {
    renderDialog();
    await selectCondition(/lecturer teaches two classes at the same time/i);
    expect(screen.queryByLabelText(/^limit/i)).not.toBeInTheDocument();
  });

  it('renders a limit field when consecutive_limit is selected', async () => {
    renderDialog();
    await selectCondition(/more than allowed consecutive periods/i);
    expect(screen.getByLabelText(/^limit/i)).toBeInTheDocument();
  });

  it('renders a limit field when gap_limit is selected', async () => {
    renderDialog();
    await selectCondition(/exceeds the allowed maximum/i);
    expect(screen.getByLabelText(/^limit/i)).toBeInTheDocument();
  });

  it('hides the limit field again after switching back to a structural condition', async () => {
    renderDialog();
    await selectCondition(/more than allowed consecutive periods/i);
    expect(screen.getByLabelText(/^limit/i)).toBeInTheDocument();

    await selectCondition(/room booked for two classes at the same time/i);
    expect(screen.queryByLabelText(/^limit/i)).not.toBeInTheDocument();
  });

  it('shows a validation error if limit is missing/non-positive on submit for consecutive_limit', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'No overload' } });
    await selectCondition(/more than allowed consecutive periods/i);

    fireEvent.click(screen.getByRole('button', { name: /add constraint/i }));

    await waitFor(() =>
      expect(screen.getByText(/limit must be a positive whole number/i)).toBeInTheDocument(),
    );
    expect(rulesService.rulesService.createConstraint).not.toHaveBeenCalled();
  });

  it('does not require a limit for a structural violation condition', async () => {
    vi.mocked(rulesService.rulesService.createConstraint).mockResolvedValueOnce({
      id: 'new', name: 'No overlaps', target: 'Class', violationCondition: 'professor_overlap',
    });
    const onSuccess = vi.fn();
    renderDialog(onSuccess);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'No overlaps' } });
    await selectCondition(/lecturer teaches two classes at the same time/i);

    fireEvent.click(screen.getByRole('button', { name: /add constraint/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(rulesService.rulesService.createConstraint).toHaveBeenCalledWith(
      expect.objectContaining({ violationCondition: 'professor_overlap' }),
    );
    const call = vi.mocked(rulesService.rulesService.createConstraint).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty('limit');
  });

  it('submits consecutive_limit with the entered limit included in the payload', async () => {
    vi.mocked(rulesService.rulesService.createConstraint).mockResolvedValueOnce({
      id: 'new', name: 'No overload', target: 'Professor', violationCondition: 'consecutive_limit', limit: 3,
    });
    const onSuccess = vi.fn();
    renderDialog(onSuccess);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'No overload' } });
    await selectCondition(/more than allowed consecutive periods/i);
    fireEvent.change(screen.getByLabelText(/^limit/i), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /add constraint/i }));

    await waitFor(() =>
      expect(rulesService.rulesService.createConstraint).toHaveBeenCalledWith(
        expect.objectContaining({ violationCondition: 'consecutive_limit', limit: 3 }),
      ),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  describe('edit mode (existingRule set)', () => {
    it('pre-fills every field from the existing constraint, including its limit, and shows the Edit title', () => {
      renderEditDialog(EXISTING_CONSTRAINT);

      expect(screen.getByRole('heading', { name: /edit hard constraint/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^name/i)).toHaveValue('No overload');
      expect(screen.getByLabelText(/^limit/i)).toHaveValue(3);
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('submits via updateConstraint with the existing id and the edited payload, not createConstraint', async () => {
      vi.mocked(rulesService.rulesService.updateConstraint).mockResolvedValueOnce({
        ...EXISTING_CONSTRAINT,
        limit: 5,
      });
      const onSuccess = vi.fn();
      renderEditDialog(EXISTING_CONSTRAINT, onSuccess);

      fireEvent.change(screen.getByLabelText(/^limit/i), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(rulesService.rulesService.updateConstraint).toHaveBeenCalledWith(
        'constraint-1',
        expect.objectContaining({ name: 'No overload', violationCondition: 'consecutive_limit', limit: 5 }),
      );
      expect(rulesService.rulesService.createConstraint).not.toHaveBeenCalled();
    });
  });
});
