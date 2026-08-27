import { createSlice, createAsyncThunk, type ActionReducerMapBuilder, type Draft } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import { scheduleService } from '@/services/scheduleService';
import type { RawRoom, RawStudentGroup, RawCourse, RawProfessor, RawTimeSlot, ApiError } from '@/types';

interface ScheduleState {
  readonly rooms: RawRoom[];
  readonly studentGroups: RawStudentGroup[];
  readonly courses: RawCourse[];
  readonly professors: RawProfessor[];
  readonly timeSlots: RawTimeSlot[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ScheduleState = {
  rooms: [],
  studentGroups: [],
  courses: [],
  professors: [],
  timeSlots: [],
  loading: false,
  error: null,
};

interface RosterPayload {
  readonly rooms: RawRoom[];
  readonly studentGroups: RawStudentGroup[];
  readonly courses: RawCourse[];
  readonly professors: RawProfessor[];
  readonly timeSlots: RawTimeSlot[];
}

// The live/editable roster for a simulation session.
export const fetchScheduleThunk = createAsyncThunk<
  RosterPayload,
  string,
  { rejectValue: ApiError }
>('schedule/fetch', async (simId, { rejectWithValue }) => {
  try {
    const result = await simulationService.getSchedule(simId);
    return {
      rooms: [...result.rooms],
      studentGroups: [...result.studentGroups],
      courses: [...result.courses],
      professors: [...result.professors],
      timeSlots: [...result.timeSlots],
    };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

// The read-only roster for the currently published (main) schedule. Kept
// separate from fetchScheduleThunk: no simId, and a 404 here just means
// "labels degrade to ID-derived fallbacks" — not "session expired".
export const fetchPublishedScheduleThunk = createAsyncThunk<
  RosterPayload,
  void,
  { rejectValue: ApiError }
>('schedule/fetchPublished', async (_, { rejectWithValue }) => {
  try {
    const result = await scheduleService.getPublishedRoster();
    return {
      rooms: [...result.rooms],
      studentGroups: [...result.studentGroups],
      courses: [...result.courses],
      professors: [...result.professors],
      timeSlots: [...result.timeSlots],
    };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const handlePending = (state: Draft<ScheduleState>): void => {
  state.loading = true;
  state.error = null;
};

const handleFulfilled = (state: Draft<ScheduleState>, action: { payload: RosterPayload }): void => {
  state.loading = false;
  state.rooms = action.payload.rooms;
  state.studentGroups = action.payload.studentGroups;
  state.courses = action.payload.courses;
  state.professors = action.payload.professors;
  state.timeSlots = action.payload.timeSlots;
};

const handleRejected = (state: Draft<ScheduleState>, action: { payload?: ApiError }): void => {
  state.loading = false;
  state.error = action.payload?.message ?? 'Failed to load schedule data';
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {},
  extraReducers: (builder: ActionReducerMapBuilder<ScheduleState>) => {
    builder
      .addCase(fetchScheduleThunk.pending, handlePending)
      .addCase(fetchScheduleThunk.fulfilled, handleFulfilled)
      .addCase(fetchScheduleThunk.rejected, handleRejected)
      .addCase(fetchPublishedScheduleThunk.pending, handlePending)
      .addCase(fetchPublishedScheduleThunk.fulfilled, handleFulfilled)
      .addCase(fetchPublishedScheduleThunk.rejected, handleRejected);
  },
});

export default scheduleSlice.reducer;
