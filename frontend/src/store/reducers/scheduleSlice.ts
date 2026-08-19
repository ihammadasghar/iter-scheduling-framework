import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { RawRoom, RawStudentGroup, ApiError } from '@/types';

interface ScheduleState {
  readonly rooms: RawRoom[];
  readonly studentGroups: RawStudentGroup[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ScheduleState = {
  rooms: [],
  studentGroups: [],
  loading: false,
  error: null,
};

export const fetchScheduleThunk = createAsyncThunk<
  { rooms: RawRoom[]; studentGroups: RawStudentGroup[] },
  string,
  { rejectValue: ApiError }
>('schedule/fetch', async (simId, { rejectWithValue }) => {
  try {
    const result = await simulationService.getSchedule(simId);
    return { rooms: [...result.rooms], studentGroups: [...result.studentGroups] };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchScheduleThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScheduleThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.rooms = action.payload.rooms;
        state.studentGroups = action.payload.studentGroups;
      })
      .addCase(fetchScheduleThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load schedule data';
      });
  },
});

export default scheduleSlice.reducer;
