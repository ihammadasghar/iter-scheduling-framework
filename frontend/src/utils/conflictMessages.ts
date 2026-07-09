import type { ConflictType } from '@/types';

/**
 * Pure function — maps a conflict type + resolved resource name to a plain English sentence.
 * Never exposes type codes to the user.
 */
export const getConflictMessage = (type: ConflictType, resourceName: string): string => {
  switch (type) {
    case 'ROOM_DOUBLE_BOOK':
      return `Room ${resourceName} is booked for two classes at the same time`;
    case 'PROFESSOR_OVERLAP':
      return `${resourceName} is already teaching another class at this time`;
    case 'GROUP_OVERLAP':
      return `${resourceName} students are in two classes at once`;
  }
};
