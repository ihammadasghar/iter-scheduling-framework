import { Box, Chip, Tooltip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { ScheduleClass } from '@/types';

const messages = defineMessages({
  tooltip: {
    id: 'classChip.tooltip',
    defaultMessage: '{title} · Room: {room} · Prof: {professor}',
  },
  selectedAriaLabel: {
    id: 'classChip.selectedAriaLabel',
    defaultMessage: '{label} — selected',
  },
  conflictTooltip: {
    id: 'classChip.conflictTooltip',
    defaultMessage: '{conflictSummary} — click for details',
  },
  conflictAriaLabel: {
    id: 'classChip.conflictAriaLabel',
    defaultMessage: '{label} — {conflictSummary}',
  },
  hasConflictAriaLabel: {
    id: 'classChip.hasConflictAriaLabel',
    defaultMessage: '{label} — has conflict',
  },
});

type ChipVariant = 'default' | 'conflicted' | 'selected';

interface ClassChipProps {
  readonly classItem: ScheduleClass;
  readonly state?: ChipVariant;
  // One-line "what's wrong" summary for the conflicted state — shown on hover
  // so the warning icon is self-explanatory without clicking in first.
  readonly conflictSummary?: string;
}

export default function ClassChip({
  classItem,
  state = 'default',
  conflictSummary,
}: ClassChipProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((s) => s.ui.selectedClassId);
  const names = useScheduleNames();
  const isSelected = selectedId === classItem.id;
  const resolvedState: ChipVariant = state !== 'default' ? state : isSelected ? 'selected' : 'default';
  // Fades every other block once a class is selected, so the Inspector's
  // header text has one obvious block to tie back to instead of competing
  // with a full grid of equally-weighted chips (cognitive-walkthrough
  // finding, issue #7).
  const dimmed = selectedId !== null && !isSelected;

  const buildTooltip = (cls: ScheduleClass, n: ScheduleNames): string =>
    intl.formatMessage(messages.tooltip, {
      title: cls.title,
      room: n.roomName(cls.roomId),
      professor: n.professorName(cls.professorId),
    });

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
          aria-label={intl.formatMessage(messages.selectedAriaLabel, { label })}
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
            opacity: dimmed ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {label}
        </Box>
      </Tooltip>
    );
  }

  if (resolvedState === 'conflicted') {
    const conflictTooltip = conflictSummary !== undefined
      ? intl.formatMessage(messages.conflictTooltip, { conflictSummary })
      : buildTooltip(classItem, names);
    const conflictAriaLabel = conflictSummary !== undefined
      ? intl.formatMessage(messages.conflictAriaLabel, { label, conflictSummary })
      : intl.formatMessage(messages.hasConflictAriaLabel, { label });

    return (
      <Tooltip title={conflictTooltip} enterDelay={300}>
        <Chip
          label={label}
          variant="outlined"
          color="warning"
          icon={<WarningAmber />}
          onClick={handleClick}
          aria-label={conflictAriaLabel}
          sx={{ maxWidth: 140, minWidth: 44, minHeight: 44, cursor: 'pointer', opacity: dimmed ? 0.4 : 1, transition: 'opacity 0.15s' }}
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
        sx={{ maxWidth: 140, minWidth: 44, minHeight: 44, cursor: 'pointer', opacity: dimmed ? 0.4 : 1, transition: 'opacity 0.15s' }}
      />
    </Tooltip>
  );
}
