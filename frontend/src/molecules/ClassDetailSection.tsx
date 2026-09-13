import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { Edit, WarningAmber } from '@mui/icons-material';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import { useAppDispatch } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { getConflictMessage, resolveConflictResourceName } from '@/utils/conflictMessages';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import EditAssignmentDialog from '@/molecules/EditAssignmentDialog';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { Conflict, ConflictType, ScheduleClass } from '@/types';

const messages = defineMessages({
  conflictsWithAriaLabel: {
    id: 'classDetailSection.conflictsWithAriaLabel',
    defaultMessage: '{message} — conflicts with {otherLabel}, click to view that class',
  },
  conflictsWith: {
    id: 'classDetailSection.conflictsWith',
    defaultMessage: 'Conflicts with {otherLabel}',
  },
  currentAssignment: {
    id: 'classDetailSection.currentAssignment',
    defaultMessage: 'Current Assignment',
  },
  edit: {
    id: 'classDetailSection.edit',
    defaultMessage: 'Edit',
  },
  professor: {
    id: 'classDetailSection.professor',
    defaultMessage: 'Professor',
  },
  room: {
    id: 'classDetailSection.room',
    defaultMessage: 'Room',
  },
  studentGroup: {
    id: 'classDetailSection.studentGroup',
    defaultMessage: 'Student Group',
  },
  time: {
    id: 'classDetailSection.time',
    defaultMessage: 'Time',
  },
  emptyValue: {
    id: 'classDetailSection.emptyValue',
    defaultMessage: '—',
  },
});

interface ClassDetailSectionProps {
  readonly classItem: ScheduleClass;
  // Unfiltered — this component picks out the ones involving classItem itself.
  readonly conflicts?: readonly Conflict[];
  readonly classes?: readonly ScheduleClass[];
  // Omit for a read-only view — editing only makes sense against a live,
  // editable simulation session (same gating as SuggestionsList in
  // Inspector.tsx).
  readonly simId?: string;
}

// A conflict resolved down to what a single Current Assignment row needs to
// render: the plain-English message, and (when the other class is known) a
// label + id to jump to it.
interface RowConflict {
  readonly conflict: Conflict;
  readonly message: string;
  readonly otherLabel?: string;
  readonly otherClassId?: string;
}

// Picks out the conflicts relevant to one field (e.g. Room) so each Current
// Assignment row can show its own conflicts inline, right where they're
// caused, instead of in one generic list further down.
const resolveRowConflicts = (
  intl: IntlShape,
  types: readonly ConflictType[],
  relevant: readonly Conflict[],
  classItem: ScheduleClass,
  classes: readonly ScheduleClass[],
  names: ScheduleNames,
): readonly RowConflict[] =>
  relevant
    .filter((c) => types.includes(c.type))
    .map((conflict) => {
      const resourceName = resolveConflictResourceName(intl, conflict, classes, names);
      const message = getConflictMessage(intl, conflict.type, resourceName);
      const otherClassId = conflict.classIds.find((id) => id !== classItem.id);
      const otherClass = otherClassId !== undefined
        ? classes.find((c) => c.id === otherClassId)
        : undefined;
      const otherLabel = otherClass !== undefined
        ? `${names.courseCode(otherClass.courseId)} — ${otherClass.title}`
        : undefined;
      return { conflict, message, otherLabel, otherClassId: otherClass?.id };
    });

interface DetailRowProps {
  readonly label: string;
  readonly value: string;
  readonly conflicts?: readonly RowConflict[];
  readonly onJumpTo?: (classId: string) => void;
  readonly action?: React.ReactNode;
}

const DetailRow = ({
  label,
  value,
  conflicts = [],
  onJumpTo,
  action,
}: DetailRowProps): React.ReactElement => {
  const intl = useIntl();
  return (
    <ListItem disablePadding sx={{ display: 'block', py: 1 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ minWidth: 90, flexShrink: 0, fontSize: 14 }}
        >
          {label}
        </Typography>
        <Typography variant="body1" sx={{ fontSize: 16, flex: 1 }}>
          {value}
        </Typography>
        {action}
      </Box>
      {conflicts.map(({ conflict, message, otherLabel, otherClassId }) => (
        <ListItemButton
          key={conflict.id}
          onClick={() => otherClassId !== undefined && onJumpTo?.(otherClassId)}
          disabled={otherClassId === undefined}
          sx={{ alignItems: 'flex-start', gap: 1, py: 0.5, pl: '90px' }}
          aria-label={
            otherLabel !== undefined
              ? intl.formatMessage(messages.conflictsWithAriaLabel, { message, otherLabel })
              : message
          }
        >
          <ListItemIcon sx={{ minWidth: 24, mt: 0.25 }}>
            <WarningAmber fontSize="small" color="warning" />
          </ListItemIcon>
          <ListItemText
            primary={message}
            secondary={otherLabel !== undefined ? intl.formatMessage(messages.conflictsWith, { otherLabel }) : undefined}
            slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
          />
        </ListItemButton>
      ))}
    </ListItem>
  );
};

export default function ClassDetailSection({
  classItem,
  conflicts = [],
  classes = [],
  simId,
}: ClassDetailSectionProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const names = useScheduleNames();
  const { professorName, roomName, groupName } = names;
  const timeSlotLabels = [...classItem.timeSlotIds]
    .map(formatTimeSlotFull)
    .join(', ');

  const [editOpen, setEditOpen] = useState(false);

  const relevant = conflicts.filter((c) => c.classIds.includes(classItem.id));
  const professorConflicts = resolveRowConflicts(
    intl, ['PROFESSOR_OVERLAP'], relevant, classItem, classes, names,
  );
  const roomConflicts = resolveRowConflicts(
    intl, ['ROOM_DOUBLE_BOOK', 'ROOM_CAPACITY_EXCEEDED'], relevant, classItem, classes, names,
  );
  const groupConflicts = resolveRowConflicts(
    intl, ['GROUP_OVERLAP'], relevant, classItem, classes, names,
  );

  const handleJumpTo = (otherClassId: string): void => {
    dispatch(selectClass(otherClassId));
    dispatch(toggleInspector(true));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2, pt: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 0 }}>
          {intl.formatMessage(messages.currentAssignment)}
        </Typography>
        {simId !== undefined && (
          <Button size="small" startIcon={<Edit fontSize="small" />} onClick={() => setEditOpen(true)}>
            {intl.formatMessage(messages.edit)}
          </Button>
        )}
      </Box>
      <Divider />
      <List disablePadding sx={{ px: 2 }}>
        <DetailRow
          label={intl.formatMessage(messages.professor)}
          value={professorName(classItem.professorId)}
          conflicts={professorConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow
          label={intl.formatMessage(messages.room)}
          value={roomName(classItem.roomId)}
          conflicts={roomConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow
          label={intl.formatMessage(messages.studentGroup)}
          value={groupName(classItem.studentGroupId)}
          conflicts={groupConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow label={intl.formatMessage(messages.time)} value={timeSlotLabels || intl.formatMessage(messages.emptyValue)} />
      </List>
      {simId !== undefined && (
        <EditAssignmentDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          simId={simId}
          classId={classItem.id}
          currentClass={classItem}
        />
      )}
    </Box>
  );
}
