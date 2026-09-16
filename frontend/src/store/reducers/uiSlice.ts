import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ViewByOption } from '@/types';

// Ephemeral view/interaction state — intentionally NOT persisted, unlike
// identitySlice.ts, which holds who's using the app.
interface UiState {
  readonly selectedClassId: string | null;
  readonly inspectorOpen: boolean;
  readonly viewBy: ViewByOption;
  // Whether the user has ever selected a class this session — drives the
  // simulation screen's first-run discoverability hint (issue #6) and lets
  // the conflict chip step back once the user has found the grid on their
  // own.
  readonly hasInteractedWithClass: boolean;
}

const initialState: UiState = {
  selectedClassId: null,
  inspectorOpen: false,
  viewBy: 'room',
  hasInteractedWithClass: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectClass(state, action: PayloadAction<string>) {
      state.selectedClassId = action.payload;
      state.inspectorOpen = true;
      state.hasInteractedWithClass = true;
    },
    deselectClass(state) {
      state.selectedClassId = null;
      state.inspectorOpen = false;
    },
    toggleInspector(state, action: PayloadAction<boolean>) {
      state.inspectorOpen = action.payload;
      if (!action.payload) {
        state.selectedClassId = null;
      }
    },
    setViewBy(state, action: PayloadAction<ViewByOption>) {
      state.viewBy = action.payload;
    },
  },
});

export const {
  selectClass,
  deselectClass,
  toggleInspector,
  setViewBy,
} = uiSlice.actions;

export default uiSlice.reducer;
