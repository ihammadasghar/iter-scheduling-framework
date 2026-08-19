import { createSelector } from '@reduxjs/toolkit';
import { useAppSelector } from '@/store/hooks';
import { buildScheduleNames, type ScheduleNames } from '@/utils/scheduleNames';
import type { RootState } from '@/store/store';

// Memoized once, shared by every consumer — important because ClassChip
// renders once per class (1000+ on the large-scale generator's data), and
// an unmemoized selector would rebuild all four id→entity maps on every one
// of those renders instead of once when the roster actually changes.
const selectScheduleNames = createSelector(
  [
    (s: RootState) => s.schedule.rooms,
    (s: RootState) => s.schedule.professors,
    (s: RootState) => s.schedule.courses,
    (s: RootState) => s.schedule.studentGroups,
  ],
  buildScheduleNames,
);

export const useScheduleNames = (): ScheduleNames => useAppSelector(selectScheduleNames);
