import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { ScheduleClass, UpdateClassRequest, ApiError } from '@/types';

interface ClassState {
  readonly classes: ScheduleClass[];
  readonly total: number;
  readonly currentPage: number;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ClassState = {
  classes: [],
  total: 0,
  currentPage: 0,
  hasMore: true,
  loading: false,
  error: null,
};

const PAGE_SIZE = 50;

export const fetchClassesPage = createAsyncThunk<
  { classes: ScheduleClass[]; total: number; page: number },
  { simId: string; page: number },
  { rejectValue: ApiError }
>('class/fetchPage', async ({ simId, page }, { rejectWithValue }) => {
  try {
    const result = await simulationService.getSimulationClasses(simId, page, PAGE_SIZE);
    return { classes: [...result.data], total: result.total, page: result.page };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const updateClassThunk = createAsyncThunk<
  ScheduleClass,
  { simId: string; classId: string; params: UpdateClassRequest },
  { rejectValue: ApiError }
>('class/update', async ({ simId, classId, params }, { rejectWithValue }) => {
  try {
    return await simulationService.updateClass(simId, classId, params);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const commitSimulationThunk = createAsyncThunk<
  void,
  string,
  { rejectValue: ApiError }
>('class/commit', async (simId, { rejectWithValue }) => {
  try {
    await simulationService.commitSimulation(simId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const classSlice = createSlice({
  name: 'class',
  initialState,
  reducers: {
    resetClasses(state) {
      state.classes = [];
      state.total = 0;
      state.currentPage = 0;
      state.hasMore = true;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClassesPage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClassesPage.fulfilled, (state, action) => {
        const newIds = new Set(state.classes.map((c) => c.id));
        const fresh = action.payload.classes.filter((c) => !newIds.has(c.id));
        const merged = [...state.classes, ...fresh];
        return {
          ...state,
          loading: false,
          classes: merged,
          total: action.payload.total,
          currentPage: action.payload.page,
          hasMore: merged.length < action.payload.total,
        };
      })
      .addCase(fetchClassesPage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load classes';
      })
      .addCase(updateClassThunk.pending, (state) => {
        state.error = null;
      })
      .addCase(updateClassThunk.fulfilled, (state, action) => {
        return {
          ...state,
          classes: state.classes.map((c) =>
            c.id === action.payload.id ? action.payload : c,
          ),
        };
      })
      .addCase(updateClassThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to update class';
      })
      .addCase(commitSimulationThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to save changes';
      });
  },
});

export const { resetClasses } = classSlice.actions;
export default classSlice.reducer;
