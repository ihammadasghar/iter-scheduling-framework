import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { proposalService } from '@/services/proposalService';
import type { Proposal, ProposalDetail, CreateProposalRequest, ApiError } from '@/types';

interface ProposalState {
  readonly proposals: Proposal[];       // ci:ready
  readonly blocked: Proposal[];         // ci:blocked
  readonly current: ProposalDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ProposalState = {
  proposals: [],
  blocked: [],
  current: null,
  loading: false,
  error: null,
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
      // Blocked proposals — failure is silent (Gap 2)
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
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchProposalDetailThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load proposal details';
      })
      // Create proposal
      .addCase(createProposalThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProposalThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.proposals = [...state.proposals, action.payload];
      })
      .addCase(createProposalThunk.rejected, (state, action) => {
        state.loading = false;
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

export const { clearCurrentProposal, clearProposalError } = proposalSlice.actions;
export default proposalSlice.reducer;
