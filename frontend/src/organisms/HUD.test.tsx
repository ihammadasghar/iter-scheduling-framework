import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import HUD from './HUD';
import conflictReducer from '@/store/reducers/conflictSlice';
import diffReducer from '@/store/reducers/diffSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import { simulationService } from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
    getDiff: vi.fn().mockResolvedValue({ added: [], removed: [], changed: [] }),
  },
}));

const makeStore = () =>
  configureStore({
    reducer: {
      conflict: conflictReducer,
      diff: diffReducer,
      metric: metricReducer,
      score: scoreReducer,
      session: sessionReducer,
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
    },
  });

// HUD itself now only renders the "Submit Proposal" footer button — the
// conflicts/score chips it used to render moved up into TimetablePage's
// toolbar (see TimetablePage.test.tsx's "toolbar chips" describe block for
// that behavior). HUD still owns triggering the on-mount/post-patch fetches
// those chips (and ChangesSoFarPanel) read from, so that wiring is what's
// covered here.
const render_ = async (onSubmit = vi.fn()) => {
  render(
    <Provider store={makeStore()}>
      <IntlProvider locale="en" messages={{}}>
        <HUD simId="sim-test" onSubmitProposal={onSubmit} />
      </IntlProvider>
    </Provider>,
  );
  await waitFor(() => expect(simulationService.getConflicts).toHaveBeenCalled());
};

describe('HUD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Submit Proposal" button', async () => {
    await render_();
    expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
  });

  it('calls onSubmitProposal when submit button is clicked', async () => {
    const onSubmit = vi.fn();
    await render_(onSubmit);
    screen.getByRole('button', { name: /submit proposal/i }).click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('fetches conflicts, metrics, score, and the live diff on mount', async () => {
    await render_();
    expect(simulationService.getConflicts).toHaveBeenCalledWith('sim-test');
    expect(simulationService.getMetrics).toHaveBeenCalledWith('sim-test');
    expect(simulationService.getScore).toHaveBeenCalledWith('sim-test');
    expect(simulationService.getDiff).toHaveBeenCalledWith('sim-test');
  });
});
