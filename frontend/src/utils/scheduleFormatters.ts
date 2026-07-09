/**
 * Utilities for deriving human-readable labels from schedule entity IDs
 * when full schedule metadata is not separately loaded.
 *
 * ID formats follow the convention defined in schedule.json:
 *   TimeSlot  → TS_MON_P1, TS_TUE_P2, …
 *   Room      → RM_101, RM_LAB_A, …
 *   Professor → PRF_SMITH, PRF_DOE, …
 *   Group     → GRP_BIO_Y1, GRP_CS_Y2, …
 *   Course    → CRS_BIO101, CRS_CS301, …
 */

const DAY_ORDER: Record<string, number> = {
  MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6,
};

const DAY_NAMES: Readonly<Record<string, string>> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

/** Sort time-slot IDs chronologically: by day then by period number. */
export const sortTimeSlotIds = (ids: readonly string[]): string[] =>
  [...ids].sort((a, b) => {
    const [, dayA = '', periodA = ''] = a.split('_');
    const [, dayB = '', periodB = ''] = b.split('_');
    const dayDiff = (DAY_ORDER[dayA] ?? 99) - (DAY_ORDER[dayB] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    // Extract trailing number for period comparison
    const numA = parseInt(periodA.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(periodB.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

/** Format a time-slot ID into a compact display label: "TS_MON_P1" → "Mon P1" */
export const formatTimeSlotLabel = (id: string): string => {
  const parts = id.split('_').slice(1); // drop "TS" prefix
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
};

/** Format a time-slot ID into a full label: "TS_MON_P1" → "Monday Period 1" */
export const formatTimeSlotFull = (id: string): string => {
  const [, day = '', period = ''] = id.split('_');
  const dayName = DAY_NAMES[day] ?? day;
  const periodNum = period.replace(/\D/g, '');
  return `${dayName} Period ${periodNum}`;
};

/** Format a room ID: "RM_101" → "Room 101", "RM_LAB_A" → "Lab A" */
export const formatRoomLabel = (id: string): string => {
  const parts = id.split('_').slice(1); // drop "RM"
  if (parts.length === 1 && /^\d+$/.test(parts[0] ?? '')) {
    return `Room ${parts[0]}`;
  }
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
};

/** Format a professor ID: "PRF_SMITH" → "Smith" */
export const formatProfessorLabel = (id: string): string => {
  const name = id.split('_').slice(1).join(' ');
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

/** Format a student group ID: "GRP_BIO_Y1" → "Bio Y1" */
export const formatGroupLabel = (id: string): string => {
  const parts = id.split('_').slice(1); // drop "GRP"
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
};

/** Format a course ID: "CRS_BIO101" → "BIO101" */
export const formatCourseLabel = (id: string): string => {
  const parts = id.split('_').slice(1); // drop "CRS"
  return parts.join('').toUpperCase();
};

/** Unique sorted array (stable set dedup). */
export const uniqueSorted = <T,>(arr: readonly T[], compare?: (a: T, b: T) => number): T[] => {
  const set = [...new Set(arr)];
  return compare ? set.sort(compare) : set;
};
