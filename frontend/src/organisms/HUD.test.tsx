import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import HUD from './HUD';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import { simulationService } from '@/services/simulationService';
import type { Conflict, MetricResult } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
  },
}));

const makeStore = () =>
  configureStore({
    reducer: {
      conflict: conflictReducer,
      metric: metricReducer,
      session: sessionReducer,
      class: classReducer,
      ui: uiReducer,
    },
  });

const render_ = async (
  conflicts: Conflict[] = [],
  metrics: MetricResult[] = [],
  onSubmit = vi.fn(),
) => {
  vi.mocked(simulationService.getConflicts).mockResolvedValue(conflicts);
  vi.mocked(simulationService.getMetrics).mockResolvedValue(metrics);
  render(
    <Provider store={makeStore()}>
      <HUD simId="sim-test" onSubmitProposal={onSubmit} />
    </Provider>,
  );
  // Wait for on-mount fetches to resolve and loading chip to disappear
  await waitFor(
    () => expect(screen.queryByText(/checking conflicts/i)).not.toBeInTheDocument(),
    { timeout: 2000 },
  );
};

describe('HUD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "No scheduling conflicts" chip when there are no conflicts', async () => {
    await render_([]);
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows error chip with singular count when 1 conflict exists', async () => {
    const conflicts: Conflict[] = [
      {
        id: 'c1',
        type: 'ROOM_DOUBLE_BOOK',
        classIds: ['CLS_001', 'CLS_002'] as unknown as readonly [string, string],
        message: '',
      },
    ];
    await render_(conflicts);
    expect(screen.getByText(/1 scheduling conflict/i)).toBeInTheDocument();
  });

  it('shows plural conflicts count when >1 conflicts exist', async () => {
    const conflicts: Conflict[] = [
      {
        id: 'c1',
        type: 'ROOM_DOUBLE_BOOK',
        classIds: ['CLS_001', 'CLS_002'] as unknown as readonly [string, string],
        message: '',
      },
      {
        id: 'c2',
        type: 'PROFESSOR_OVERLAP',
        classIds: ['CLS_003', 'CLS_004'] as unknown as readonly [string, string],
        message: '',
      },
    ];
    await render_(conflicts);
    expect(screen.getByText(/2 scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows "No metrics configured" when metrics array is empty', async () => {
    await render_([], []);
    expect(screen.getByText(/no metrics configured/i)).toBeInTheDocument();
  });

  it('renders metric chips when metrics are present', async () => {
    await render_([], [{ name: 'Room Utilisation', value: 82, unit: '%' }]);
    expect(screen.getByText(/room utilisation: 82%/i)).toBeInTheDocument();
  });

  it('renders "Submit Proposal" button', async () => {
    await render_();
    expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
  });

  it('calls onSubmitProposal when submit button is clicked', async () => {
    const onSubmit = vi.fn();
    await render_([], [], onSubmit);
    screen.getByRole('button', { name: /submit proposal/i }).click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('never displays raw conflict type codes', async () => {
    const conflicts: Conflict[] = [
      {
        id: 'c1',
        type: 'ROOM_DOUBLE_BOOK',
        classIds: ['CLS_001', 'CLS_002'] as unknown as readonly [string, string],
        message: '',
      },
    ];
    await render_(conflicts);
    expect(screen.queryByText(/ROOM_DOUBLE_BOOK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PROFESSOR_OVERLAP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GROUP_OVERLAP/)).not.toBeInTheDocument();
  });
});
