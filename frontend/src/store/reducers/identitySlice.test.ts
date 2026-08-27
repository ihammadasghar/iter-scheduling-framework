import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import identityReducer, { hydrateIdentity, setIdentity, clearIdentity } from './identitySlice';
import type { Identity } from '@/types';

const STORAGE_KEY = 'unisched_identity';

const makeStore = () => configureStore({ reducer: { identity: identityReducer } });

const PROFESSOR_IDENTITY: Identity = {
  role: 'professor',
  professorId: 'PRF_SMITH',
  studentGroupId: null,
};

describe('identitySlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialises with identity=null and hydrated=false', () => {
    const store = makeStore();
    expect(store.getState().identity).toEqual({ identity: null, hydrated: false });
  });

  it('hydrateIdentity reads nothing from empty storage and marks hydrated', () => {
    const store = makeStore();
    store.dispatch(hydrateIdentity());
    expect(store.getState().identity).toEqual({ identity: null, hydrated: true });
  });

  it('setIdentity stores the identity in state and persists it to localStorage', () => {
    const store = makeStore();
    store.dispatch(setIdentity(PROFESSOR_IDENTITY));

    expect(store.getState().identity.identity).toEqual(PROFESSOR_IDENTITY);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(PROFESSOR_IDENTITY);
  });

  it('hydrateIdentity reads a previously persisted identity back', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PROFESSOR_IDENTITY));
    const store = makeStore();
    store.dispatch(hydrateIdentity());

    expect(store.getState().identity).toEqual({ identity: PROFESSOR_IDENTITY, hydrated: true });
  });

  it('clearIdentity resets identity to null and removes it from localStorage', () => {
    const store = makeStore();
    store.dispatch(setIdentity(PROFESSOR_IDENTITY));
    store.dispatch(clearIdentity());

    expect(store.getState().identity.identity).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('degrades to identity=null when storage holds malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const store = makeStore();
    store.dispatch(hydrateIdentity());

    expect(store.getState().identity.identity).toBeNull();
  });

  it('degrades to identity=null when storage holds an unrecognised role', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: 'superadmin' }));
    const store = makeStore();
    store.dispatch(hydrateIdentity());

    expect(store.getState().identity.identity).toBeNull();
  });

  it('admin identity has null professorId/studentGroupId', () => {
    const store = makeStore();
    store.dispatch(setIdentity({ role: 'admin', professorId: null, studentGroupId: null }));
    expect(store.getState().identity.identity).toEqual({
      role: 'admin', professorId: null, studentGroupId: null,
    });
  });
});
