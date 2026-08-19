import {
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { getConflictMessage, resolveConflictResourceName } from '@/utils/conflictMessages';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { Conflict } from '@/types';

interface ConflictPopoverProps {
  readonly open: boolean;
  readonly anchorEl: HTMLElement | null;
  readonly conflicts: readonly Conflict[];
  readonly onClose: () => void;
}

export default function ConflictPopover({
  open,
  anchorEl,
  conflicts,
  onClose,
}: ConflictPopoverProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const classes = useAppSelector((s) => s.class.classes);
  const names = useScheduleNames();

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
          const resourceName = resolveConflictResourceName(conflict, classes, names);
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
