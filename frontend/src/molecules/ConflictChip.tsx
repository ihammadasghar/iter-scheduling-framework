import { useRef, useState } from 'react';
import { Chip, CircularProgress } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import ConflictPopover from '@/molecules/ConflictPopover';
import type { Conflict } from '@/types';

const messages = defineMessages({
  loadingAriaLabel: {
    id: 'conflictChip.loadingAriaLabel',
    defaultMessage: 'Loading conflicts…',
  },
  checkingConflicts: {
    id: 'conflictChip.checkingConflicts',
    defaultMessage: 'Checking conflicts…',
  },
  noConflicts: {
    id: 'conflictChip.noConflicts',
    defaultMessage: 'No scheduling conflicts',
  },
  conflictsLabel: {
    id: 'conflictChip.conflictsLabel',
    defaultMessage: '{count, plural, one {# scheduling conflict} other {# scheduling conflicts}} — click to see details',
  },
});

interface ConflictChipProps {
  readonly conflicts: readonly Conflict[];
  readonly loading: boolean;
}

export default function ConflictChip({
  conflicts,
  loading,
}: ConflictChipProps): React.ReactElement {
  const intl = useIntl();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (loading) {
    return (
      <Chip
        icon={<CircularProgress size={16} aria-label={intl.formatMessage(messages.loadingAriaLabel)} />}
        label={intl.formatMessage(messages.checkingConflicts)}
        variant="outlined"
        sx={{ minHeight: 32 }}
      />
    );
  }

  const count = conflicts.length;

  if (count === 0) {
    return (
      <Chip
        icon={<CheckCircle />}
        label={intl.formatMessage(messages.noConflicts)}
        color="success"
        variant="outlined"
        aria-label={intl.formatMessage(messages.noConflicts)}
        sx={{ minHeight: 32 }}
      />
    );
  }

  const conflictsLabel = intl.formatMessage(messages.conflictsLabel, { count });

  return (
    <>
      <Chip
        ref={anchorRef}
        icon={<Warning />}
        label={conflictsLabel}
        color="error"
        variant="outlined"
        onClick={() => setPopoverOpen(true)}
        aria-label={conflictsLabel}
        sx={{ minHeight: 32, cursor: 'pointer' }}
      />
      <ConflictPopover
        open={popoverOpen}
        anchorEl={anchorRef.current}
        conflicts={conflicts}
        onClose={() => setPopoverOpen(false)}
      />
    </>
  );
}
