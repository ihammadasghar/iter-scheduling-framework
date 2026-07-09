import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useInactivityWarning } from './useInactivityWarning';
import sessionReducer, { markHeartbeat, setSession } from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';

const makeStore = () =>
  configureStore({
    reducer: { session: sessionReducer, class: classReducer },
  });

describe('useInactivityWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWarning = (store = makeStore()) => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    return { ...renderHook(() => useInactivityWarning('sim-1'), { wrapper }), store };
  };

  it('showWarning is false initially', () => {
    const { result } = renderWarning();
    expect(result.current.showWarning).toBe(false);
  });

  it('showWarning becomes true after 3 minutes', async () => {
    const { result } = renderWarning();
    await act(async () => { vi.advanceTimersByTime(3 * 60 * 1000 + 100); });
    expect(result.current.showWarning).toBe(true);
  });

  it('showWarning does not trigger before 3 minutes', async () => {
    const { result } = renderWarning();
    await act(async () => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(result.current.showWarning).toBe(false);
  });

  it('dismiss() hides the banner without resetting the timer', async () => {
    const { result } = renderWarning();
    await act(async () => { vi.advanceTimersByTime(3 * 60 * 1000 + 100); });
    expect(result.current.showWarning).toBe(true);

    act(() => { result.current.dismiss(); });
    expect(result.current.showWarning).toBe(false);
  });

  it('any API activity (markHeartbeat) resets the timer and hides banner', async () => {
    const store = makeStore();
    store.dispatch(setSession('sim-1'));

    const { result } = renderWarning(store);
    await act(async () => { vi.advanceTimersByTime(3 * 60 * 1000 + 100); });
    expect(result.current.showWarning).toBe(true);

    // Simulate API activity
    await act(async () => {
      store.dispatch(markHeartbeat());
      vi.advanceTimersByTime(100); // let effect re-run
    });
    expect(result.current.showWarning).toBe(false);
  });
});
