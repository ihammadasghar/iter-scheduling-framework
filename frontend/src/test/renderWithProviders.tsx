import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import diffReducer from '@/store/reducers/diffSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';
import identityReducer from '@/store/reducers/identitySlice';
import languageReducer from '@/store/reducers/languageSlice';
import type { RootState } from '@/store/store';
import { DEFAULT_LOCALE, MESSAGES, type SupportedLocale } from '@/i18n/config';

// Same reducer shape as store.ts, rebuilt fresh per test so state from one
// test never leaks into another.
const rootReducer = {
  simulation: simulationReducer,
  class: classReducer,
  conflict: conflictReducer,
  diff: diffReducer,
  metric: metricReducer,
  score: scoreReducer,
  proposal: proposalReducer,
  rules: rulesReducer,
  schedule: scheduleReducer,
  session: sessionReducer,
  ui: uiReducer,
  identity: identityReducer,
  language: languageReducer,
};

interface RenderWithProvidersOptions {
  readonly locale?: SupportedLocale;
  readonly preloadedState?: Partial<RootState>;
  readonly route?: string;
}

/**
 * Renders a component wrapped in a fresh Redux store, react-intl's
 * IntlProvider, and a MemoryRouter — the combination most components now
 * need once they read locale-aware state or render <FormattedMessage>.
 * Pass `preloadedState` to seed just the slice(s) the component under test
 * cares about (mirrors the per-file makeStore() pattern used before this
 * helper existed, e.g. OnboardingFlow.test.tsx).
 */
export function renderWithProviders(
  ui: ReactElement,
  { locale = DEFAULT_LOCALE, preloadedState, route = '/' }: RenderWithProvidersOptions = {},
) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState,
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <IntlProvider locale={locale} messages={MESSAGES[locale]} defaultLocale={DEFAULT_LOCALE}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </IntlProvider>
      </Provider>,
    ),
  };
}
