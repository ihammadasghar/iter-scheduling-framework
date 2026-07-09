import { Box, Chip, Tooltip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import {
  formatCourseLabel,
  formatRoomLabel,
  formatProfessorLabel,
} from '@/utils/scheduleFormatters';
import type { ScheduleClass } from '@/types';

type ChipVariant = 'default' | 'conflicted' | 'selected';

interface ClassChipProps {
  readonly classItem: ScheduleClass;
  readonly state?: ChipVariant;
}

const buildTooltip = (cls: ScheduleClass): string => [
  cls.title,
  `Room: ${formatRoomLabel(cls.roomId)}`,
  `Prof: ${formatProfessorLabel(cls.professorId)}`,
].join(' · ');

export default function ClassChip({
  classItem,
  state = 'default',
}: ClassChipProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((s) => s.ui.selectedClassId);
  const resolvedState: ChipVariant = state !== 'default' ? state : selectedId === classItem.id ? 'selected' : 'default';

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation(); // prevent grid's deselectClass handler
    dispatch(selectClass(classItem.id));
    dispatch(toggleInspector(true));
  };

  const label = formatCourseLabel(classItem.courseId);

  if (resolvedState === 'selected') {
    return (
      <Tooltip title={buildTooltip(classItem)} enterDelay={300}>
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
            borderRadius: 2,
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
    return (
      <Tooltip title={buildTooltip(classItem)} enterDelay={300}>
        <Chip
          label={label}
          variant="outlined"
          color="warning"
          icon={<WarningAmber />}
          onClick={handleClick}
          aria-label={`${label} — has conflict`}
          sx={{ maxWidth: 140, minWidth: 44, minHeight: 44, cursor: 'pointer' }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={buildTooltip(classItem)} enterDelay={300}>
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
