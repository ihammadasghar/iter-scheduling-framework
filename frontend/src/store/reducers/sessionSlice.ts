import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { updateClassThunk, commitSimulationThunk } from './classSlice';

interface SessionState {
  readonly simulationId: string | null;
  readonly lastHeartbeat: number;
  readonly expired: boolean;
  readonly hasUnsavedChanges: boolean;
}

const initialState: SessionState = {
  simulationId: null,
  lastHeartbeat: 0,
  expired: false,
  hasUnsavedChanges: false,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<string>) {
      state.simulationId = action.payload;
      state.expired = false;
      state.hasUnsavedChanges = false;
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
