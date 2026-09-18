import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { updateClassThunk, commitSimulationThunk } from './classSlice';

interface SessionState {
  readonly simulationId: string | null;
  readonly lastHeartbeat: number;
  readonly expired: boolean;
  readonly hasUnsavedChanges: boolean;
  /** Epoch ms of the last successful class PATCH — used to trigger HUD re-fetch debounce. */
  readonly lastPatchAt: number;
}

const initialState: SessionState = {
  simulationId: null,
  lastHeartbeat: 0,
  expired: false,
  hasUnsavedChanges: false,
  lastPatchAt: 0,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    // Re-entering the *same* simulation (e.g. navigating back from the
    // full-page class editor to the timetable, which remounts this effect)
    // must not discard an hasUnsavedChanges=true set moments earlier by an
    // edit that hasn't been committed yet — doing so silently skips the
    // CommitGate on submit, so the proposal gets validated against a stale,
    // pre-edit branch. Only a genuine switch to a different simulation
    // resets the flag.
    setSession(state, action: PayloadAction<string>) {
      const isSameSession = state.simulationId === action.payload;
      state.simulationId = action.payload;
      state.expired = false;
      state.hasUnsavedChanges = isSameSession ? state.hasUnsavedChanges : false;
      state.lastHeartbeat = Date.now();
    },
    clearSession(state) {
      state.simulationId = null;
      state.expired = false;
      state.hasUnsavedChanges = false;
      state.lastHeartbeat = 0;
    },
    markExpired(state) {
      state.expired = true;
    },
    markHeartbeat(state) {
      state.lastHeartbeat = Date.now();
    },
    setHasUnsavedChanges(state, action: PayloadAction<boolean>) {
      state.hasUnsavedChanges = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Any successful class edit marks the session as having unsaved changes
      .addCase(updateClassThunk.fulfilled, (state) => {
        state.hasUnsavedChanges = true;
        state.lastPatchAt = Date.now();
      })
      // A successful commit clears the unsaved-changes flag
      .addCase(commitSimulationThunk.fulfilled, (state) => {
        state.hasUnsavedChanges = false;
      });
  },
});

export const {
  setSession,
  clearSession,
  markExpired,
  markHeartbeat,
  setHasUnsavedChanges,
} = sessionSlice.actions;

export default sessionSlice.reducer;
