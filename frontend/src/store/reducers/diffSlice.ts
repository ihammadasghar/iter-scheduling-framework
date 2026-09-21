import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { ScheduleDiff, ApiError } from '@/types';

interface DiffState {
  readonly diff: ScheduleDiff | null;
  readonly loading: boolean;
  readonly lastFetchedAt: number | null;
  readonly error: string | null;
}

const initialState: DiffState = {
  diff: null,
  loading: false,
  lastFetchedAt: null,
  error: null,
};

export const fetchSimulationDiffThunk = createAsyncThunk<
  ScheduleDiff,
  string,
  { rejectValue: ApiError }
>('diff/fetch', async (simId, { rejectWithValue }) => {
  try {
    return await simulationService.getDiff(simId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const diffSlice = createSlice({
  name: 'diff',
  initialState,
  reducers: {
    clearDiff(state) {
      state.diff = null;
      state.lastFetchedAt = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSimulationDiffThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSimulationDiffThunk.fulfilled, (state, action) => {
        return {
          ...state,
          loading: false,
          diff: action.payload,
          lastFetchedAt: Date.now(),
        };
      })
      .addCase(fetchSimulationDiffThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load changes';
      });
  },
});

export const { clearDiff } = diffSlice.actions;
export default diffSlice.reducer;
