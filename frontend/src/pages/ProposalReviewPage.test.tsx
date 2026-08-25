import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProposalReviewPage from './ProposalReviewPage';
import proposalReducer from '@/store/reducers/proposalSlice';
import uiReducer from '@/store/reducers/uiSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import * as proposalService from '@/services/proposalService';

// Must be defined inside vi.hoisted so the mock factories can reference it safely
const { fakeProposal, mockProposalService, mockScheduleService } = vi.hoisted(() => {
  const emptyComparison = {
    baselineScore: { score: 0, breakdown: [] },
    candidateScore: {
      score: 82,
      breakdown: [
        { name: 'Room Utilization', value: 78, unit: '%', weight: 2, threshold: 80, normalizedScore: 90 },
      ],
    },
    baselineConflicts: [],
    candidateConflicts: [],
    conflictDelta: { added: [], resolved: [] },
    classDiff: { added: [], removed: [], changed: [] },
  };
  const fp = {
    id: 'p1',
    simulationId: 'sim-alice-abc123',
    status: 'READY' as const,
    createdAt: new Date().toISOString(),
    description: 'Moved Biology class',
    diff: '',
    userId: 'alice',
    score: emptyComparison.candidateScore,
    comparison: emptyComparison,
  };
  const svc = {
    listProposals: vi.fn().mockResolvedValue([]),
    listBlockedProposals: vi.fn().mockResolvedValue([]),
    getProposal: vi.fn().mockResolvedValue(fp),
    createProposal: vi.fn(),
    mergeProposal: vi.fn(),
    rejectProposal: vi.fn(),
  };
  const scheduleSvc = {
    getPublishedClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    getPublishedRoster: vi.fn().mockResolvedValue({
      metadata: { semesterId: '', semesterName: '', academicYear: '' },
      timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [],
    }),
  };
  return { fakeProposal: fp, mockProposalService: svc, mockScheduleService: scheduleSvc };
});

vi.mock('@/services/proposalService', () => ({
  proposalService: mockProposalService,
}));

vi.mock('@/services/scheduleService', () => ({
  scheduleService: mockScheduleService,
}));

const makeStore = () =>
  configureStore({
    reducer: {
      proposal: proposalReducer,
      ui: uiReducer,
      simulation: simulationReducer,
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      rules: rulesReducer,
      session: sessionReducer,
      schedule: scheduleReducer,
    },
  });

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/admin/proposals/p1']}>
        <Routes>
          <Route path="/admin/proposals/:id" element={<ProposalReviewPage />} />
          <Route path="/admin/proposals" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('ProposalReviewPage', () => {
  it('renders "Proposal Review" heading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /proposal review/i })).toBeInTheDocument(),
    );
  });

  it('shows CI status badge for READY status', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/checked — no conflicts/i)).toBeInTheDocument(),
    );
  });

  it('shows CI status badge for BLOCKED status', async () => {
    vi.mocked(proposalService.proposalService.getProposal).mockResolvedValueOnce({
      ...fakeProposal, status: 'BLOCKED',
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/has scheduling conflicts/i)).toBeInTheDocument(),
    );
  });

  it('shows Approve & Publish button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve.*publish/i })).toBeInTheDocument(),
    );
  });

  it('shows Close This Proposal button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close this proposal/i })).toBeInTheDocument(),
    );
  });

  it('opens approve confirmation dialog on Approve click', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /publish changes/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/live timetable/i)).toBeInTheDocument();
  });

  it('opens close confirmation dialog on Close click', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /close this proposal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close this proposal/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /close this proposal\?/i })).toBeInTheDocument(),
    );
  });

  it('can cancel the approve dialog', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() => screen.getByRole('heading', { name: /publish changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /publish changes/i })).not.toBeInTheDocument(),
    );
  });

  it('renders "Back to Proposals" button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /back to proposals/i })).toBeInTheDocument(),
    );
  });

  it('shows the candidate weighted score chip in the metrics comparison panel', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/score: 82\/100/i)).toBeInTheDocument(),
    );
  });

  it('shows disclaimer text in CI status badge', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/does not re-check/i)).toBeInTheDocument(),
    );
  });

  it('dispatches fetchProposalDetailThunk on mount', async () => {
    renderPage();
    await waitFor(() =>
      expect(vi.mocked(proposalService.proposalService.getProposal)).toHaveBeenCalledWith('p1'),
    );
  });

  it('shows merge success snackbar after approve', async () => {
    vi.mocked(proposalService.proposalService.mergeProposal).mockResolvedValueOnce(fakeProposal);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() => screen.getByRole('heading', { name: /publish changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, publish/i }));
    await waitFor(() =>
      expect(screen.getByText(/changes published to the live timetable/i)).toBeInTheDocument(),
    );
  });

  it('shows inline error when reject fails', async () => {
    vi.mocked(proposalService.proposalService.rejectProposal).mockRejectedValueOnce({ statusCode: 404 });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /close this proposal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close this proposal/i }));
    await waitFor(() => screen.getByRole('heading', { name: /close this proposal\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, close/i }));
    await waitFor(() =>
      expect(screen.getByText(/could not close proposal/i)).toBeInTheDocument(),
    );
  });

  it('shows close success snackbar after reject', async () => {
    vi.mocked(proposalService.proposalService.rejectProposal).mockResolvedValueOnce(undefined);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /close this proposal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close this proposal/i }));
    await waitFor(() => screen.getByRole('heading', { name: /close this proposal\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, close/i }));
    await waitFor(() =>
      expect(screen.getByText(/proposal closed/i)).toBeInTheDocument(),
    );
  });

  it('fetches the published schedule roster for name resolution on mount', async () => {
    renderPage();
    await waitFor(() =>
      expect(mockScheduleService.getPublishedRoster).toHaveBeenCalled(),
    );
  });

  it('shows a "no changes" message when the class diff is empty', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('No changes detected in this proposal.')).toBeInTheDocument(),
    );
  });

  it('renders both baseline and candidate score chips in the metrics panel', async () => {
    renderPage();
    // Baseline has no breakdown in this fixture, so its chip reads
    // "no metrics defined" rather than a numeric score — see WeightedScoreChip.
    await waitFor(() => expect(screen.getByText(/score: no metrics defined/i)).toBeInTheDocument());
    expect(screen.getByText('Score: 82/100')).toBeInTheDocument();
  });

  it('renders health tiles for the conflicts comparison', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('No scheduling conflicts')).toHaveLength(2));
  });

  it('renders added, removed, and changed classes when the comparison has a full diff', async () => {
    vi.mocked(proposalService.proposalService.getProposal).mockResolvedValueOnce({
      ...fakeProposal,
      comparison: {
        ...fakeProposal.comparison,
        classDiff: {
          added: [{
            id: 'CLS_002', courseId: 'CRS_002', title: 'New Chemistry Lab', professorId: 'PRF_CHEN',
            studentGroupId: 'GRP_002', roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'],
          }],
          removed: [{
            id: 'CLS_003', courseId: 'CRS_003', title: 'Old History Seminar', professorId: 'PRF_JONES',
            studentGroupId: 'GRP_003', roomId: 'RM_103', timeSlotIds: ['TS_WED_P1'],
          }],
          changed: [{
            classId: 'CLS_001',
            before: {
              id: 'CLS_001', courseId: 'CRS_001', title: 'Biology Lecture', professorId: 'PRF_SMITH',
              studentGroupId: 'GRP_001', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
            },
            after: {
              id: 'CLS_001', courseId: 'CRS_001', title: 'Biology Lecture', professorId: 'PRF_SMITH',
              studentGroupId: 'GRP_001', roomId: 'RM_104', timeSlotIds: ['TS_MON_P1'],
            },
            fieldChanges: [{ field: 'roomId', before: 'RM_101', after: 'RM_104' }],
          }],
        },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('New Chemistry Lab')).toBeInTheDocument());
    expect(screen.getByText('Old History Seminar')).toBeInTheDocument();
    expect(screen.getByText('Biology Lecture')).toBeInTheDocument();
  });
});
