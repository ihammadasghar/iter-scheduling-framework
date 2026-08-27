import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { Simulation, ApiError } from '@/types';

const STORAGE_KEY = 'unisched_simulations';

const readStorage = (): Simulation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Simulation[]) : [];
  } catch {
    return [];
  }
};

const writeStorage = (simulations: readonly Simulation[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simulations));
};

interface SimulationState {
  readonly simulations: Simulation[];
  readonly current: Simulation | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: SimulationState = {
  simulations: [],
  current: null,
  loading: false,
  error: null,
};

export const createSimulationThunk = createAsyncThunk<
  Simulation,
  string,
  { rejectValue: ApiError }
>('simulation/create', async (userId, { rejectWithValue }) => {
  try {
    return await simulationService.createSimulation(userId);
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

// Updates a stale draft to reflect the latest published schedule while
// preserving the user's own edits (see ScheduleUpdatedModal, which dispatches
// this when the user chooses "Update My Draft"). Returns the simulationId
// alongside the new baseScheduleVersion so the reducer knows which stored
// record to patch.
export const rebaseSimulationThunk = createAsyncThunk<
  { simulationId: string; baseScheduleVersion: string },
  { simulationId: string; baseScheduleVersion: string },
  { rejectValue: ApiError }
>('simulation/rebase', async ({ simulationId, baseScheduleVersion }, { rejectWithValue }) => {
  try {
    const result = await simulationService.rebaseSimulation(simulationId, baseScheduleVersion);
    return { simulationId, baseScheduleVersion: result.baseScheduleVersion };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

export const deleteSimulationThunk = createAsyncThunk<
  string,
  string,
  { rejectValue: ApiError }
>('simulation/delete', async (simId, { rejectWithValue }) => {
  try {
    await simulationService.deleteSimulation(simId);
    return simId;
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const simulationSlice = createSlice({
  name: 'simulation',
  initialState,
  reducers: {
    loadSimulationsFromStorage(state) {
      state.simulations = readStorage();
    },
    setCurrentSimulation(state, action: PayloadAction<Simulation>) {
      state.current = action.payload;
    },
    clearCurrentSimulation(state) {
      state.current = null;
    },
    clearSimulationError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSimulationThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSimulationThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.simulations = [...state.simulations, action.payload];
        state.current = action.payload;
        writeStorage(state.simulations);
      })
      .addCase(createSimulationThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to create simulation';
      })
      .addCase(rebaseSimulationThunk.fulfilled, (state, action) => {
        const { simulationId, baseScheduleVersion } = action.payload;
        state.simulations = state.simulations.map((s) =>
          s.id === simulationId ? { ...s, baseScheduleVersion } : s,
        );
        if (state.current?.id === simulationId) {
          state.current = { ...state.current, baseScheduleVersion };
        }
        writeStorage(state.simulations);
      })
      .addCase(rebaseSimulationThunk.rejected, (state, action) => {
        state.error = action.payload?.message ?? 'Failed to update your draft with the latest published schedule';
      })
      .addCase(deleteSimulationThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteSimulationThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.simulations = state.simulations.filter((s) => s.id !== action.payload);
        if (state.current?.id === action.payload) {
          state.current = null;
        }
        writeStorage(state.simulations);
      })
      .addCase(deleteSimulationThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to delete simulation';
      });
  },
});

export const {
  loadSimulationsFromStorage,
  setCurrentSimulation,
  clearCurrentSimulation,
  clearSimulationError,
} = simulationSlice.actions;

export default simulationSlice.reducer;
