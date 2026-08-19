import { Alert, Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { useAppDispatch } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { getConflictMessage, resolveConflictResourceName } from '@/utils/conflictMessages';
import { formatCourseLabel } from '@/utils/scheduleFormatters';
import type { Conflict, ScheduleClass } from '@/types';

interface ConflictDetailSectionProps {
  readonly classItem: ScheduleClass;
  // Unfiltered — this component picks out the ones involving classItem itself.
  readonly conflicts: readonly Conflict[];
  readonly classes: readonly ScheduleClass[];
}

/**
 * Answers "what conflicts need to be resolved" for the selected class — shown
 * right below its details, before Smart Suggestions, so the problem is
 * visible before the fix. Renders nothing when the class has no conflicts.
 */
export default function ConflictDetailSection({
  classItem,
  conflicts,
  classes,
}: ConflictDetailSectionProps): React.ReactElement | null {
  const dispatch = useAppDispatch();
  const relevant = conflicts.filter((c) => c.classIds.includes(classItem.id));

  if (relevant.length === 0) return null;

  const handleJumpTo = (otherClassId: string): void => {
    dispatch(selectClass(otherClassId));
    dispatch(toggleInspector(true));
  };

  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', px: 2, pt: 2 }}
      >
        Needs to Be Resolved
      </Typography>
      <Alert severity="warning" sx={{ mx: 2, mt: 1 }}>
        {relevant.length === 1
          ? 'This class has a scheduling conflict that must be resolved before this proposal can be submitted.'
          : `This class has ${relevant.length} scheduling conflicts that must be resolved before this proposal can be submitted.`}
      </Alert>
      <List dense sx={{ px: 1 }}>
        {relevant.map((conflict) => {
          const resourceName = resolveConflictResourceName(conflict, classes);
          const message = getConflictMessage(conflict.type, resourceName);
          const otherClassId = conflict.classIds.find((id) => id !== classItem.id);
          const otherClass = otherClassId !== undefined
            ? classes.find((c) => c.id === otherClassId)
            : undefined;
          const otherLabel = otherClass !== undefined
            ? `${formatCourseLabel(otherClass.courseId)} — ${otherClass.title}`
            : undefined;

          return (
            <ListItemButton
              key={conflict.id}
              onClick={() => otherClass !== undefined && handleJumpTo(otherClass.id)}
              disabled={otherClass === undefined}
              sx={{ alignItems: 'flex-start', gap: 1, py: 1 }}
              aria-label={
                otherLabel !== undefined
                  ? `${message} — conflicts with ${otherLabel}, click to view that class`
                  : message
              }
            >
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                <WarningAmber fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText
                primary={message}
                secondary={otherLabel !== undefined ? `Conflicts with ${otherLabel}` : undefined}
                slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
