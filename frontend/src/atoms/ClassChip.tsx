import { Box, Chip, Tooltip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { ScheduleClass } from '@/types';

type ChipVariant = 'default' | 'conflicted' | 'selected';

interface ClassChipProps {
  readonly classItem: ScheduleClass;
  readonly state?: ChipVariant;
  // One-line "what's wrong" summary for the conflicted state — shown on hover
  // so the warning icon is self-explanatory without clicking in first.
  readonly conflictSummary?: string;
}

const buildTooltip = (cls: ScheduleClass, names: ScheduleNames): string => [
  cls.title,
  `Room: ${names.roomName(cls.roomId)}`,
  `Prof: ${names.professorName(cls.professorId)}`,
].join(' · ');

export default function ClassChip({
  classItem,
  state = 'default',
  conflictSummary,
}: ClassChipProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((s) => s.ui.selectedClassId);
  const names = useScheduleNames();
  const resolvedState: ChipVariant = state !== 'default' ? state : selectedId === classItem.id ? 'selected' : 'default';

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation(); // prevent grid's deselectClass handler
    dispatch(selectClass(classItem.id));
    dispatch(toggleInspector(true));
  };

  // Short code (e.g. "BIO101"), not the full course name — this chip is
  // capped at 140px.
  const label = names.courseCode(classItem.courseId);

  if (resolvedState === 'selected') {
    return (
      <Tooltip title={buildTooltip(classItem, names)} enterDelay={300}>
        <Box
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label={`${label} — selected`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent); }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            maxWidth: 140,
            border: 2,
            borderColor: 'primary.main',
            // Full pill radius — matches the real MUI Chip shape used by
            // the 'default'/'conflicted' states below, rather than the
            // theme's general (rectangular-panel) corner radius.
            borderRadius: '999px',
            boxShadow: 3,
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
            px: 1.5,
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 600,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Box>
      </Tooltip>
    );
  }

  if (resolvedState === 'conflicted') {
    const conflictTooltip = conflictSummary !== undefined
      ? `${conflictSummary} — click for details`
      : buildTooltip(classItem, names);
    const conflictAriaLabel = conflictSummary !== undefined
      ? `${label} — ${conflictSummary}`
      : `${label} — has conflict`;

    return (
      <Tooltip title={conflictTooltip} enterDelay={300}>
        <Chip
          label={label}
          variant="outlined"
          color="warning"
          icon={<WarningAmber />}
          onClick={handleClick}
          aria-label={conflictAriaLabel}
          sx={{ maxWidth: 140, minWidth: 44, minHeight: 44, cursor: 'pointer' }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={buildTooltip(classItem, names)} enterDelay={300}>
      <Chip
        label={label}
        variant="filled"
        onClick={handleClick}
        aria-label={label}
        sx={{ maxWidth: 140, minWidth: 44, minHeight: 44, cursor: 'pointer' }}
      />
    </Tooltip>
  );
}
