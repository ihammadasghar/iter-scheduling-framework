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
import { useAppDispatch } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { getConflictMessage, resolveConflictResourceName } from '@/utils/conflictMessages';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import EditAssignmentDialog from '@/molecules/EditAssignmentDialog';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { Conflict, ConflictType, ScheduleClass } from '@/types';

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
  types: readonly ConflictType[],
  relevant: readonly Conflict[],
  classItem: ScheduleClass,
  classes: readonly ScheduleClass[],
  names: ScheduleNames,
): readonly RowConflict[] =>
  relevant
    .filter((c) => types.includes(c.type))
    .map((conflict) => {
      const resourceName = resolveConflictResourceName(conflict, classes, names);
      const message = getConflictMessage(conflict.type, resourceName);
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
}: DetailRowProps): React.ReactElement => (
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
            ? `${message} — conflicts with ${otherLabel}, click to view that class`
            : message
        }
      >
        <ListItemIcon sx={{ minWidth: 24, mt: 0.25 }}>
          <WarningAmber fontSize="small" color="warning" />
        </ListItemIcon>
        <ListItemText
          primary={message}
          secondary={otherLabel !== undefined ? `Conflicts with ${otherLabel}` : undefined}
          slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
        />
      </ListItemButton>
    ))}
  </ListItem>
);

export default function ClassDetailSection({
  classItem,
  conflicts = [],
  classes = [],
  simId,
}: ClassDetailSectionProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const names = useScheduleNames();
  const { professorName, roomName, groupName } = names;
  const timeSlotLabels = [...classItem.timeSlotIds]
    .map(formatTimeSlotFull)
    .join(', ');

  const [editOpen, setEditOpen] = useState(false);

  const relevant = conflicts.filter((c) => c.classIds.includes(classItem.id));
  const professorConflicts = resolveRowConflicts(
    ['PROFESSOR_OVERLAP'], relevant, classItem, classes, names,
  );
  const roomConflicts = resolveRowConflicts(
    ['ROOM_DOUBLE_BOOK', 'ROOM_CAPACITY_EXCEEDED'], relevant, classItem, classes, names,
  );
  const groupConflicts = resolveRowConflicts(
    ['GROUP_OVERLAP'], relevant, classItem, classes, names,
  );

  const handleJumpTo = (otherClassId: string): void => {
    dispatch(selectClass(otherClassId));
    dispatch(toggleInspector(true));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2, pt: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 0 }}>
          Current Assignment
        </Typography>
        {simId !== undefined && (
          <Button size="small" startIcon={<Edit fontSize="small" />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        )}
      </Box>
      <Divider />
      <List disablePadding sx={{ px: 2 }}>
        <DetailRow
          label="Professor"
          value={professorName(classItem.professorId)}
          conflicts={professorConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow
          label="Room"
          value={roomName(classItem.roomId)}
          conflicts={roomConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow
          label="Student Group"
          value={groupName(classItem.studentGroupId)}
          conflicts={groupConflicts}
          onJumpTo={handleJumpTo}
        />
        <DetailRow label="Time" value={timeSlotLabels || '—'} />
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
