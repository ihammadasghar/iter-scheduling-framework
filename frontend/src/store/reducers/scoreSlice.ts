import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { WeightedScoreResult, ApiError } from '@/types';

interface ScoreState {
  readonly current: WeightedScoreResult | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ScoreState = {
  current: null,
  loading: false,
  error: null,
};

export const fetchScoreThunk = createAsyncThunk<
  WeightedScoreResult,
  string,
  { rejectValue: ApiError }
>('score/fetch', async (simId, { rejectWithValue }) => {
  try {
    return await simulationService.getScore(simId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const scoreSlice = createSlice({
  name: 'score',
  initialState,
  reducers: {
    clearScore(state) {
      state.current = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchScoreThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScoreThunk.fulfilled, (state, action) => {
        return { ...state, loading: false, current: action.payload };
      })
      .addCase(fetchScoreThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load score';
      });
  },
});

export const { clearScore } = scoreSlice.actions;
export default scoreSlice.reducer;
