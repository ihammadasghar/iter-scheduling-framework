import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';

const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

interface UseInactivityWarningResult {
  readonly showWarning: boolean;
  readonly dismiss: () => void;
}

/**
 * Tracks inactivity via `sessionSlice.lastPatchAt` — any successful class edit
 * (which updates `lastPatchAt`) resets the timer.
 * After 3 minutes of no PATCH activity, `showWarning` becomes true.
 * Dismissing hides the banner but does NOT reset the underlying timer.
 */
export function useInactivityWarning(simId: string): UseInactivityWarningResult {
  const lastPatchAt = useAppSelector((s) => s.session.lastPatchAt);
  const lastHeartbeat = useAppSelector((s) => s.session.lastHeartbeat);
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any API activity resets the banner and dismissed state
  const latestActivity = Math.max(lastPatchAt, lastHeartbeat);

  useEffect(() => {
    if (!simId) return;

    // Activity happened — hide the warning and reset dismissed flag
    setShowWarning(false);
    setDismissed(false);

    if (timerRef.current !== null) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, INACTIVITY_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [simId, latestActivity]);

  const dismiss = useCallback((): void => {
    setDismissed(true);
  }, []);

  return { showWarning: showWarning && !dismissed, dismiss };
}
