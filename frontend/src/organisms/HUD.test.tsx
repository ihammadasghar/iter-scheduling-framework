import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import HUD from './HUD';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import { simulationService } from '@/services/simulationService';
import type { Conflict, MetricResult, WeightedScoreResult } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
  },
}));

const makeStore = () =>
  configureStore({
    reducer: {
      conflict: conflictReducer,
      metric: metricReducer,
      score: scoreReducer,
      session: sessionReducer,
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
    },
  });

const render_ = async (
  conflicts: Conflict[] = [],
  metrics: MetricResult[] = [],
  onSubmit = vi.fn(),
  score: WeightedScoreResult = { score: 0, breakdown: [] },
) => {
  vi.mocked(simulationService.getConflicts).mockResolvedValue(conflicts);
  vi.mocked(simulationService.getMetrics).mockResolvedValue(metrics);
  vi.mocked(simulationService.getScore).mockResolvedValue(score);
  render(
    <Provider store={makeStore()}>
      <IntlProvider locale="en" messages={{}}>
        <HUD simId="sim-test" onSubmitProposal={onSubmit} />
      </IntlProvider>
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

  it('renders the institution-defined score chip when metrics are configured', async () => {
    await render_([], [], vi.fn(), {
      score: 82,
      breakdown: [
        { name: 'Room Utilisation', value: 82, unit: '%', weight: 1, threshold: 90, normalizedScore: 82 },
      ],
    });
    expect(screen.getByText(/score: 82\/100/i)).toBeInTheDocument();
  });

  it('shows "no metrics defined" score label when no institution metrics are configured', async () => {
    await render_([], [], vi.fn(), { score: 0, breakdown: [] });
    expect(screen.getByText(/score: no metrics defined/i)).toBeInTheDocument();
  });

  it('renders the conflict chip softened before any class has been selected', async () => {
    const conflicts: Conflict[] = [
      {
        id: 'c1',
        type: 'ROOM_DOUBLE_BOOK',
        classIds: ['CLS_001', 'CLS_002'] as unknown as readonly [string, string],
        message: '',
      },
    ];
    await render_(conflicts);
    expect(screen.getByText(/1 scheduling conflict/i).closest('.MuiChip-root')).toHaveClass('MuiChip-colorDefault');
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
