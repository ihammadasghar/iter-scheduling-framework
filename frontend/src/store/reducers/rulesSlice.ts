import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { rulesService } from '@/services/rulesService';
import type {
  MetricRule,
  Constraint,
  CreateMetricRuleRequest,
  CreateConstraintRequest,
  ApiError,
} from '@/types';

interface RulesState {
  readonly metrics: MetricRule[];
  readonly constraints: Constraint[];
  readonly loading: boolean;
  readonly unavailable: boolean;
  readonly error: string | null;
}

const initialState: RulesState = {
  metrics: [],
  constraints: [],
  loading: false,
  unavailable: false,
  error: null,
};

const is501 = (err: ApiError | undefined): boolean => err?.statusCode === 501;

export const fetchMetricRulesThunk = createAsyncThunk<
  MetricRule[],
  void,
  { rejectValue: ApiError }
>('rules/fetchMetrics', async (_, { rejectWithValue }) => {
  try {
    return await rulesService.getMetricRules();
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const createMetricRuleThunk = createAsyncThunk<
  MetricRule,
  CreateMetricRuleRequest,
  { rejectValue: ApiError }
>('rules/createMetric', async (params, { rejectWithValue }) => {
  try {
    return await rulesService.createMetricRule(params);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const deleteMetricRuleThunk = createAsyncThunk<
  string,
  string,
  { rejectValue: ApiError }
>('rules/deleteMetric', async (id, { rejectWithValue }) => {
  try {
    await rulesService.deleteMetricRule(id);
    return id;
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const fetchConstraintsThunk = createAsyncThunk<
  Constraint[],
  void,
  { rejectValue: ApiError }
>('rules/fetchConstraints', async (_, { rejectWithValue }) => {
  try {
    return await rulesService.getConstraints();
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const createConstraintThunk = createAsyncThunk<
  Constraint,
  CreateConstraintRequest,
  { rejectValue: ApiError }
>('rules/createConstraint', async (params, { rejectWithValue }) => {
  try {
    return await rulesService.createConstraint(params);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const deleteConstraintThunk = createAsyncThunk<
  string,
  string,
  { rejectValue: ApiError }
>('rules/deleteConstraint', async (id, { rejectWithValue }) => {
  try {
    await rulesService.deleteConstraint(id);
    return id;
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const rulesSlice = createSlice({
  name: 'rules',
  initialState,
  reducers: {
    clearRulesError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Metric rules
      .addCase(fetchMetricRulesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMetricRulesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = action.payload;
      })
      .addCase(fetchMetricRulesThunk.rejected, (state, action) => {
        state.loading = false;
        if (is501(action.payload)) {
          state.unavailable = true;
        } else {
          state.error = action.payload?.message ?? 'Failed to load metric rules';
        }
      })
      .addCase(createMetricRuleThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createMetricRuleThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.metrics = [...state.metrics, action.payload];
      })
      .addCase(createMetricRuleThunk.rejected, (state, action) => {
        state.loading = false;
        if (is501(action.payload)) {
          state.unavailable = true;
        } else {
          state.error = action.payload?.message ?? 'Failed to create metric rule';
        }
      })
      .addCase(deleteMetricRuleThunk.fulfilled, (state, action) => {
        state.metrics = state.metrics.filter((m) => m.id !== action.payload);
      })
      .addCase(deleteMetricRuleThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to delete metric rule';
      })
      // Constraints
      .addCase(fetchConstraintsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConstraintsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.constraints = action.payload;
      })
      .addCase(fetchConstraintsThunk.rejected, (state, action) => {
        state.loading = false;
        if (is501(action.payload)) {
          state.unavailable = true;
        } else {
          state.error = action.payload?.message ?? 'Failed to load constraints';
        }
      })
      .addCase(createConstraintThunk.fulfilled, (state, action) => {
        state.constraints = [...state.constraints, action.payload];
      })
      .addCase(createConstraintThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to create constraint';
      })
      .addCase(deleteConstraintThunk.fulfilled, (state, action) => {
        state.constraints = state.constraints.filter((c) => c.id !== action.payload);
      })
      .addCase(deleteConstraintThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to delete constraint';
      });
  },
});

export const { clearRulesError } = rulesSlice.actions;
export default rulesSlice.reducer;
