import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Identity } from '@/types';

// Which role/person is using the app — chosen once via OnboardingFlow and
// persisted here so a reload doesn't re-prompt. Mirrors simulationSlice.ts's
// localStorage pattern. Deliberately its own slice, not part of uiSlice:
// uiSlice's other fields (selectedClassId, inspectorOpen, viewBy) are
// intentionally ephemeral and reset on reload, while identity must not.
const STORAGE_KEY = 'unisched_identity';

const readStorage = (): Identity | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    // Guard against malformed/stale shapes rather than trusting old storage —
    // a bad parse should degrade to "not onboarded yet", not crash the app.
    if (
      parsed.role !== 'professor' && parsed.role !== 'student' && parsed.role !== 'admin'
    ) {
      return null;
    }
    return {
      role: parsed.role,
      professorId: parsed.professorId ?? null,
      studentGroupId: parsed.studentGroupId ?? null,
    };
  } catch {
    return null;
  }
};

const writeStorage = (identity: Identity): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
};

const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

interface IdentityState {
  // null ⇒ onboarding hasn't been completed (or was reset) — OnboardingFlow
  // gates the app on this.
  readonly identity: Identity | null;
  // false until hydrateIdentity() has checked localStorage once — prevents
  // OnboardingFlow flashing open for a frame before that check resolves.
  readonly hydrated: boolean;
}

const initialState: IdentityState = {
  identity: null,
  hydrated: false,
};

const identitySlice = createSlice({
  name: 'identity',
  initialState,
  reducers: {
    hydrateIdentity(state) {
      state.identity = readStorage();
      state.hydrated = true;
    },
    setIdentity(state, action: PayloadAction<Identity>) {
      writeStorage(action.payload);
      state.identity = action.payload;
    },
    clearIdentity(state) {
      clearStorage();
      state.identity = null;
    },
  },
});

export const { hydrateIdentity, setIdentity, clearIdentity } = identitySlice.actions;
export default identitySlice.reducer;
