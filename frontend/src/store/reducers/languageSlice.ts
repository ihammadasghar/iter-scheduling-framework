import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@/i18n/config';

// Which language the UI renders in — chosen via the TopAppBar language
// switcher and persisted here so a reload doesn't reset it. Mirrors
// identitySlice.ts's localStorage pattern.
const STORAGE_KEY = 'unisched_locale';

const readStorage = (): SupportedLocale | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Guard against malformed/stale/unsupported values rather than trusting
    // old storage — a bad parse should degrade to the developer-configured
    // default, not crash the app.
    if (typeof parsed !== 'string' || !isSupportedLocale(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStorage = (locale: SupportedLocale): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locale));
};

interface LanguageState {
  readonly locale: SupportedLocale;
  // false until hydrateLocale() has checked localStorage once — avoids a
  // flash of the wrong language before that check resolves.
  readonly hydrated: boolean;
}

const initialState: LanguageState = {
  locale: DEFAULT_LOCALE,
  hydrated: false,
};

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    hydrateLocale(state) {
      state.locale = readStorage() ?? DEFAULT_LOCALE;
      state.hydrated = true;
    },
    setLocale(state, action: PayloadAction<SupportedLocale>) {
      writeStorage(action.payload);
      state.locale = action.payload;
    },
  },
});

export const { hydrateLocale, setLocale } = languageSlice.actions;
export default languageSlice.reducer;
