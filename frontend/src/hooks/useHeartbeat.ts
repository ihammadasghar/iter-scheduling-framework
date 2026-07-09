import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { markHeartbeat, markExpired } from '@/store/reducers/sessionSlice';
import { simulationService } from '@/services/simulationService';

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Fires a heartbeat every 60 seconds while simId is set.
 * - 200 OK  → dispatches markHeartbeat()
 * - 404     → dispatches markExpired() (session GC'd by server)
 * - Clears the interval on unmount or when simId becomes null.
 */
export function useHeartbeat(simId: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!simId) return;

    const tick = async (): Promise<void> => {
      try {
        await simulationService.sendHeartbeat(simId);
        dispatch(markHeartbeat());
      } catch (err: unknown) {
        const status = (err as { statusCode?: number; response?: { status?: number } })?.statusCode
          ?? (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          dispatch(markExpired());
        }
        // All other errors are silent — network blips shouldn't end the session
      }
    };

    const intervalId = setInterval(() => { void tick(); }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [simId, dispatch]);
}
