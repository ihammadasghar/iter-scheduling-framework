import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { Conflict, ApiError } from '@/types';

interface ConflictState {
  readonly conflicts: Conflict[];
  readonly loading: boolean;
  readonly lastFetchedAt: number | null;
  readonly error: string | null;
}

const initialState: ConflictState = {
  conflicts: [],
  loading: false,
  lastFetchedAt: null,
  error: null,
};

export const fetchConflictsThunk = createAsyncThunk<
  Conflict[],
  string,
  { rejectValue: ApiError }
>('conflict/fetch', async (simId, { rejectWithValue }) => {
  try {
    return await simulationService.getConflicts(simId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const conflictSlice = createSlice({
  name: 'conflict',
  initialState,
  reducers: {
    clearConflicts(state) {
      state.conflicts = [];
      state.lastFetchedAt = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConflictsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConflictsThunk.fulfilled, (state, action) => {
        return {
          ...state,
          loading: false,
          conflicts: action.payload,
          lastFetchedAt: Date.now(),
        };
      })
      .addCase(fetchConflictsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load conflicts';
      });
  },
});

export const { clearConflicts } = conflictSlice.actions;
export default conflictSlice.reducer;
