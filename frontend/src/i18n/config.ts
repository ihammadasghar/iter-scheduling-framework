import enMessages from '@/locales/en.json';
import ptPTMessages from '@/locales/pt-PT.json';

// The languages this app can render its UI in. Add a new entry here (plus a
// catalog file under src/locales/ and an entry in MUI_LOCALE_MAP in
// styles/theme.ts) to support another language.
export type SupportedLocale = 'en' | 'pt-PT';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'pt-PT'];

// Display names shown in the language switcher (each language names itself,
// not translated through the active locale).
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  'pt-PT': 'Português (PT)',
};

// ── DEVELOPER-FACING SWITCH ────────────────────────────────────────────────
// The language a fresh install (or a browser with localStorage cleared)
// boots into. This is NOT the same as the user's own persisted preference —
// see languageSlice.ts, which only falls back to this constant when it has
// nothing stored yet. Change this to alter what a first-time visitor sees
// by default; it does not affect anyone who has already picked a language.
export const DEFAULT_LOCALE: SupportedLocale = 'en';
// ────────────────────────────────────────────────────────────────────────────

export const isSupportedLocale = (value: string): value is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

// Flat id -> translated string catalogs, keyed by locale. Populated via
// `pnpm run i18n:extract` (regenerates en.json from defineMessages calls)
// plus hand translation of src/locales/pt-PT.json.
export const MESSAGES: Record<SupportedLocale, Record<string, string>> = {
  en: enMessages,
  'pt-PT': ptPTMessages,
};
