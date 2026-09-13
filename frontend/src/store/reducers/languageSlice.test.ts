import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import languageReducer, { hydrateLocale, setLocale } from './languageSlice';
import { DEFAULT_LOCALE } from '@/i18n/config';

const STORAGE_KEY = 'unisched_locale';

const makeStore = () => configureStore({ reducer: { language: languageReducer } });

describe('languageSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises with locale=DEFAULT_LOCALE and hydrated=false', () => {
    const store = makeStore();
    expect(store.getState().language).toEqual({ locale: DEFAULT_LOCALE, hydrated: false });
  });

  it('hydrateLocale reads nothing from empty storage, falls back to DEFAULT_LOCALE, and marks hydrated', () => {
    const store = makeStore();
    store.dispatch(hydrateLocale());
    expect(store.getState().language).toEqual({ locale: DEFAULT_LOCALE, hydrated: true });
  });

  it('setLocale stores the locale in state and persists it to localStorage', () => {
    const store = makeStore();
    store.dispatch(setLocale('pt-PT'));

    expect(store.getState().language.locale).toBe('pt-PT');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toBe('pt-PT');
  });

  it('hydrateLocale reads a previously persisted locale back', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('pt-PT'));
    const store = makeStore();
    store.dispatch(hydrateLocale());

    expect(store.getState().language).toEqual({ locale: 'pt-PT', hydrated: true });
  });

  it('degrades to DEFAULT_LOCALE when storage holds malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const store = makeStore();
    store.dispatch(hydrateLocale());

    expect(store.getState().language.locale).toBe(DEFAULT_LOCALE);
  });

  it('degrades to DEFAULT_LOCALE when storage holds an unsupported locale', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('fr-FR'));
    const store = makeStore();
    store.dispatch(hydrateLocale());

    expect(store.getState().language.locale).toBe(DEFAULT_LOCALE);
  });
});
