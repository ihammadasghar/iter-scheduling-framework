import {
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { getConflictMessage } from '@/utils/conflictMessages';
import {
  formatRoomLabel,
  formatProfessorLabel,
  formatGroupLabel,
} from '@/utils/scheduleFormatters';
import type { Conflict } from '@/types';

interface ConflictPopoverProps {
  readonly open: boolean;
  readonly anchorEl: HTMLElement | null;
  readonly conflicts: readonly Conflict[];
  readonly onClose: () => void;
}

/** Resolve the human-readable resource name from a conflict + the class that caused it. */
const resolveResourceName = (
  conflict: Conflict,
  classes: ReturnType<typeof useAppSelector<ReturnType<typeof useAppSelector>>>,
): string => {
  const cls = (classes as ReturnType<typeof Array.prototype.find>[])
    .find?.((c: { id: string }) => c.id === conflict.classIds[0]);
  if (!cls) return 'Unknown';
  switch (conflict.type) {
    case 'ROOM_DOUBLE_BOOK':   return formatRoomLabel(cls.roomId);
    case 'PROFESSOR_OVERLAP':  return formatProfessorLabel(cls.professorId);
    case 'GROUP_OVERLAP':      return formatGroupLabel(cls.studentGroupId);
  }
};

export default function ConflictPopover({
  open,
  anchorEl,
  conflicts,
  onClose,
}: ConflictPopoverProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const classes = useAppSelector((s) => s.class.classes);

  const handleRowClick = (conflict: Conflict): void => {
    const primaryId = conflict.classIds[0];
    if (primaryId !== undefined) {
      dispatch(selectClass(primaryId));
      dispatch(toggleInspector(true));
    }
    onClose();
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{ paper: { sx: { maxWidth: 420, maxHeight: 320, overflow: 'auto' } } }}
    >
      <Typography variant="subtitle2" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        Scheduling Conflicts
      </Typography>
      <List dense disablePadding>
        {conflicts.map((conflict) => {
          const resourceName = resolveResourceName(conflict, classes as never);
          const message = getConflictMessage(conflict.type, resourceName);
          return (
            <ListItemButton
              key={conflict.id}
              onClick={() => handleRowClick(conflict)}
              sx={{ py: 1, px: 2 }}
              aria-label={`${message} — click to inspect`}
            >
              <ListItemText
                primary={message}
                slotProps={{ primary: { variant: 'body2' } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Popover>
  );
}
