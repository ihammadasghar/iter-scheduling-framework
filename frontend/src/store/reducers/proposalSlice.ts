import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { proposalService } from '@/services/proposalService';
import type { Proposal, ProposalDetail, ProposalStatus, CreateProposalRequest, ApiError } from '@/types';

// The outcome of the most recent submission, kept in Redux (not local
// component state) so a confirmation toast survives navigating away from
// the submitting page before it fires — e.g. switching straight to admin
// view to check the proposal. Mirrors how `error` already works below.
interface LastSubmission {
  readonly status: ProposalStatus;
}

// Set instead of `error` when a submission is rejected specifically because
// the published schedule changed since the draft was created (backend code
// MAIN_SCHEDULE_CHANGED) — ScheduleUpdatedModal watches this to offer a
// rebase instead of just showing a plain error toast.
interface StaleDraft {
  readonly simulationId: string;
}

interface ProposalState {
  readonly proposals: Proposal[];       // ci:ready
  readonly blocked: Proposal[];         // ci:blocked
  readonly current: ProposalDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastSubmission: LastSubmission | null;
  readonly staleDraft: StaleDraft | null;
}

const initialState: ProposalState = {
  proposals: [],
  blocked: [],
  current: null,
  loading: false,
  error: null,
  lastSubmission: null,
  staleDraft: null,
};

export const fetchProposalsThunk = createAsyncThunk<
  Proposal[],
  void,
  { rejectValue: ApiError }
>('proposal/fetchReady', async (_, { rejectWithValue }) => {
  try {
    return await proposalService.listProposals();
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const fetchBlockedProposalsThunk = createAsyncThunk<
  Proposal[],
  void,
  { rejectValue: ApiError }
>('proposal/fetchBlocked', async (_, { rejectWithValue }) => {
  try {
    return await proposalService.listBlockedProposals();
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const fetchProposalDetailThunk = createAsyncThunk<
  ProposalDetail,
  string,
  { rejectValue: ApiError }
>('proposal/fetchDetail', async (id, { rejectWithValue }) => {
  try {
    return await proposalService.getProposal(id);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const createProposalThunk = createAsyncThunk<
  Proposal,
  CreateProposalRequest,
  { rejectValue: ApiError }
>('proposal/create', async (params, { rejectWithValue }) => {
  try {
    return await proposalService.createProposal(params);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const mergeProposalThunk = createAsyncThunk<
  Proposal,
  string,
  { rejectValue: ApiError }
>('proposal/merge', async (id, { rejectWithValue }) => {
  try {
    return await proposalService.mergeProposal(id);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const rejectProposalThunk = createAsyncThunk<
  string,
  string,
  { rejectValue: ApiError }
>('proposal/reject', async (id, { rejectWithValue }) => {
  try {
    await proposalService.rejectProposal(id);
    return id;
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const proposalSlice = createSlice({
  name: 'proposal',
  initialState,
  reducers: {
    clearCurrentProposal(state) {
      state.current = null;
    },
    clearProposalError(state) {
      state.error = null;
    },
    clearLastSubmission(state) {
      state.lastSubmission = null;
    },
    clearStaleDraft(state) {
      state.staleDraft = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Ready proposals
      .addCase(fetchProposalsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProposalsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.proposals = action.payload;
      })
      .addCase(fetchProposalsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load proposals';
      })
      // Blocked proposals — failure is silent (supplementary section)
      .addCase(fetchBlockedProposalsThunk.fulfilled, (state, action) => {
        state.blocked = action.payload;
      })
      // Proposal detail
      .addCase(fetchProposalDetailThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.current = null;
      })
      .addCase(fetchProposalDetailThunk.fulfilled, (state, action) => {
        return { ...state, loading: false, current: action.payload };
      })
      .addCase(fetchProposalDetailThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load proposal details';
      })
      // Create proposal
      .addCase(createProposalThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.staleDraft = null;
      })
      .addCase(createProposalThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.proposals = [...state.proposals, action.payload];
        state.lastSubmission = { status: action.payload.status };
      })
      .addCase(createProposalThunk.rejected, (state, action) => {
        state.loading = false;
        // The published schedule changed since this draft was created —
        // ScheduleUpdatedModal offers a rebase for this case instead of the
        // plain error toast every other rejection gets.
        if (action.payload?.code === 'MAIN_SCHEDULE_CHANGED') {
          state.staleDraft = { simulationId: action.meta.arg.simulationId };
          return;
        }
        state.error = action.payload?.message ?? 'Failed to submit proposal';
      })
      // Merge
      .addCase(mergeProposalThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(mergeProposalThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.proposals = state.proposals.filter((p) => p.id !== action.payload.id);
      })
      .addCase(mergeProposalThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to publish proposal';
      })
      // Reject
      .addCase(rejectProposalThunk.fulfilled, (state, action) => {
        state.proposals = state.proposals.filter((p) => p.id !== action.payload);
        state.blocked = state.blocked.filter((p) => p.id !== action.payload);
      })
      .addCase(rejectProposalThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to close proposal';
      });
  },
});

export const { clearCurrentProposal, clearProposalError, clearLastSubmission, clearStaleDraft } =
  proposalSlice.actions;
export default proposalSlice.reducer;
