// Shared display labels for the room/professor/student-group resource-type
// union (ViewByOption) — used by both ViewBySelector (grouping the Full
// Schedule grid's rows) and ResourcePicker (the Browse tab's entity-type
// selector) so the two pickers never drift out of sync on wording.
import { defineMessages, type IntlShape } from 'react-intl';
import type { ViewByOption } from '@/types';

const messages = defineMessages({
  room: { id: 'resourceTypeLabels.room', defaultMessage: 'Room' },
  professor: { id: 'resourceTypeLabels.professor', defaultMessage: 'Professor' },
  studentGroup: { id: 'resourceTypeLabels.studentGroup', defaultMessage: 'Student Group' },
});

export const getResourceTypeLabels = (intl: IntlShape): Record<ViewByOption, string> => ({
  room: intl.formatMessage(messages.room),
  professor: intl.formatMessage(messages.professor),
  studentGroup: intl.formatMessage(messages.studentGroup),
});
