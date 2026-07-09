import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserRole, ViewByOption } from '@/types';

interface UiState {
  readonly selectedClassId: string | null;
  readonly inspectorOpen: boolean;
  readonly role: UserRole;
  readonly viewBy: ViewByOption;
}

const initialState: UiState = {
  selectedClassId: null,
  inspectorOpen: false,
  role: 'user',
  viewBy: 'room',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectClass(state, action: PayloadAction<string>) {
      state.selectedClassId = action.payload;
      state.inspectorOpen = true;
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
    setRole(state, action: PayloadAction<UserRole>) {
      state.role = action.payload;
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
  setRole,
  setViewBy,
} = uiSlice.actions;

export default uiSlice.reducer;
