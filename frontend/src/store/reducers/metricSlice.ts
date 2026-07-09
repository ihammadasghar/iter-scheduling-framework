import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { MetricResult, ApiError } from '@/types';

interface MetricState {
  readonly metrics: MetricResult[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: MetricState = {
  metrics: [],
  loading: false,
  error: null,
};

export const fetchMetricsThunk = createAsyncThunk<
  MetricResult[],
  string,
  { rejectValue: ApiError }
>('metric/fetch', async (simId, { rejectWithValue }) => {
  try {
    return await simulationService.getMetrics(simId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const metricSlice = createSlice({
  name: 'metric',
  initialState,
  reducers: {
    clearMetrics(state) {
      state.metrics = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetricsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMetricsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload;
      })
      .addCase(fetchMetricsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load metrics';
      });
  },
});

export const { clearMetrics } = metricSlice.actions;
export default metricSlice.reducer;
