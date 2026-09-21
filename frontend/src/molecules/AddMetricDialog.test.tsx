import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import AddMetricDialog from './AddMetricDialog';
import type { MetricRule } from '@/types';
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
    updateMetricRule: vi.fn(),
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
      <IntlProvider locale="en" messages={{}}>
        <AddMetricDialog open onClose={onClose} onSuccess={onSuccess} />
      </IntlProvider>
    </Provider>,
  );

const EXISTING_RULE: MetricRule = {
  id: 'metric-1',
  name: 'Idle Gap',
  target: 'Professor',
  condition: 'avg_gap_length',
  threshold: 2,
  weight: 3,
  direction: 'lower_is_better',
};

const renderEditDialog = (existingRule: MetricRule, onSuccess = vi.fn(), onClose = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <IntlProvider locale="en" messages={{}}>
        <AddMetricDialog open onClose={onClose} onSuccess={onSuccess} existingRule={existingRule} />
      </IntlProvider>
    </Provider>,
  );

describe('AddMetricDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders name field and target select', () => {
    renderDialog();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what to measure/i)).toBeInTheDocument();
  });

  it('shows validation error if name is empty on submit', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
    );
  });

  it('calls onSuccess after successful submit', async () => {
    vi.mocked(rulesService.rulesService.createMetricRule).mockResolvedValueOnce({
      id: 'new', name: 'Test', target: 'Class', condition: 'count', threshold: 5, weight: 1,
    });
    const onSuccess = vi.fn();
    renderDialog(onSuccess);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'My Rule' } });
    // select condition — need to pick from the dropdown for classes → count
    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('renders a weight field defaulting to 1', () => {
    renderDialog();
    expect(screen.getByLabelText(/institutional preference score influence/i)).toHaveValue(1);
  });

  it('shows validation error if weight is 0 or negative on submit', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'My Rule' } });
    fireEvent.change(screen.getByLabelText(/institutional preference score influence/i), { target: { value: '0' } });
    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));
    await waitFor(() =>
      expect(screen.getByText(/institutional preference score influence must be a positive number/i)).toBeInTheDocument(),
    );
    expect(rulesService.rulesService.createMetricRule).not.toHaveBeenCalled();
  });

  it('submits with target "Class" (not "classes") and the entered weight', async () => {
    vi.mocked(rulesService.rulesService.createMetricRule).mockResolvedValueOnce({
      id: 'new', name: 'Test', target: 'Class', condition: 'count', threshold: 5, weight: 3,
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'My Rule' } });
    fireEvent.change(screen.getByLabelText(/institutional preference score influence/i), { target: { value: '3' } });
    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));

    await waitFor(() =>
      expect(rulesService.rulesService.createMetricRule).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'Class', weight: 3 }),
      ),
    );
  });

  it('pre-fills "Lower is better" when Professor / avg_gap_length is selected', async () => {
    renderDialog();

    fireEvent.mouseDown(screen.getByLabelText(/what to measure/i));
    await waitFor(() => screen.getByRole('option', { name: /professors/i }));
    fireEvent.click(screen.getByRole('option', { name: /professors/i }));

    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /average idle gap/i }));
    fireEvent.click(screen.getByRole('option', { name: /average idle gap/i }));

    expect(screen.getByLabelText(/^prefer/i)).toHaveTextContent('Lower is better');
  });

  it('lets the user override the pre-filled direction, and submits the override', async () => {
    vi.mocked(rulesService.rulesService.createMetricRule).mockResolvedValueOnce({
      id: 'new', name: 'Gap', target: 'Professor', condition: 'avg_gap_length', threshold: 2, weight: 1,
      direction: 'higher_is_better',
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Gap' } });

    fireEvent.mouseDown(screen.getByLabelText(/what to measure/i));
    await waitFor(() => screen.getByRole('option', { name: /professors/i }));
    fireEvent.click(screen.getByRole('option', { name: /professors/i }));

    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /average idle gap/i }));
    fireEvent.click(screen.getByRole('option', { name: /average idle gap/i }));

    // Pre-filled to "Lower is better" — override it to "Higher is better".
    fireEvent.mouseDown(screen.getByLabelText(/^prefer/i));
    await waitFor(() => screen.getByRole('option', { name: /^higher is better/i }));
    fireEvent.click(screen.getByRole('option', { name: /^higher is better/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));

    await waitFor(() =>
      expect(rulesService.rulesService.createMetricRule).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'higher_is_better' }),
      ),
    );
  });

  it('omits direction from the submitted payload when left as "No preference"', async () => {
    vi.mocked(rulesService.rulesService.createMetricRule).mockResolvedValueOnce({
      id: 'new', name: 'Test', target: 'Class', condition: 'count', threshold: 5, weight: 1,
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'My Rule' } });
    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    fireEvent.click(screen.getByRole('button', { name: /add this preference/i }));

    await waitFor(() => expect(rulesService.rulesService.createMetricRule).toHaveBeenCalled());
    const payload = vi.mocked(rulesService.rulesService.createMetricRule).mock.calls[0]![0];
    expect('direction' in payload).toBe(false);
  });

  it('announces the Prefer reset via aria-live when a condition with a catalog default is selected', async () => {
    renderDialog();

    fireEvent.mouseDown(screen.getByLabelText(/what to measure/i));
    await waitFor(() => screen.getByRole('option', { name: /professors/i }));
    fireEvent.click(screen.getByRole('option', { name: /professors/i }));

    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /average idle gap/i }));
    fireEvent.click(screen.getByRole('option', { name: /average idle gap/i }));

    await waitFor(() =>
      expect(screen.getByText(/prefer was pre-filled based on the selected condition/i)).toBeInTheDocument(),
    );
  });

  it('does not announce a Prefer change for a condition with no catalog default', async () => {
    renderDialog();

    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /total number/i }));
    fireEvent.click(screen.getByRole('option', { name: /total number/i }));

    expect(screen.queryByText(/prefer was pre-filled based on the selected condition/i)).not.toBeInTheDocument();
  });

  it('announces the Condition/Prefer reset via aria-live when What to measure changes', async () => {
    renderDialog();

    fireEvent.mouseDown(screen.getByLabelText(/what to measure/i));
    await waitFor(() => screen.getByRole('option', { name: /professors/i }));
    fireEvent.click(screen.getByRole('option', { name: /professors/i }));

    fireEvent.mouseDown(screen.getByLabelText(/how to measure it/i));
    await waitFor(() => screen.getByRole('option', { name: /average idle gap/i }));
    fireEvent.click(screen.getByRole('option', { name: /average idle gap/i }));

    fireEvent.mouseDown(screen.getByLabelText(/what to measure/i));
    await waitFor(() => screen.getByRole('option', { name: /classes/i }));
    fireEvent.click(screen.getByRole('option', { name: /classes/i }));

    await waitFor(() =>
      expect(
        screen.getAllByText(/condition and prefer were reset because what to measure changed/i).length,
      ).toBeGreaterThan(0),
    );
  });

  describe('edit mode (existingRule set)', () => {
    it('pre-fills every field from the existing rule and shows the Edit title', () => {
      renderEditDialog(EXISTING_RULE);

      expect(screen.getByRole('heading', { name: /edit institutional preference/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^name/i)).toHaveValue('Idle Gap');
      expect(screen.getByLabelText(/institutional preference score influence/i)).toHaveValue(3);
      expect(screen.getByLabelText(/goal value/i)).toHaveValue(2);
      expect(screen.getByLabelText(/^prefer/i)).toHaveTextContent('Lower is better');
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('submits via updateMetricRule with the existing id and the edited payload, not createMetricRule', async () => {
      vi.mocked(rulesService.rulesService.updateMetricRule).mockResolvedValueOnce({
        ...EXISTING_RULE,
        weight: 5,
      });
      const onSuccess = vi.fn();
      renderEditDialog(EXISTING_RULE, onSuccess);

      fireEvent.change(screen.getByLabelText(/institutional preference score influence/i), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(rulesService.rulesService.updateMetricRule).toHaveBeenCalledWith(
        'metric-1',
        expect.objectContaining({ name: 'Idle Gap', weight: 5, direction: 'lower_is_better' }),
      );
      expect(rulesService.rulesService.createMetricRule).not.toHaveBeenCalled();
    });
  });
});
