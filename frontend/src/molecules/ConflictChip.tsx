import { useRef, useState } from 'react';
import { Chip, CircularProgress } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import ConflictPopover from '@/molecules/ConflictPopover';
import type { Conflict } from '@/types';

interface ConflictChipProps {
  readonly conflicts: readonly Conflict[];
  readonly loading: boolean;
}

export default function ConflictChip({
  conflicts,
  loading,
}: ConflictChipProps): React.ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (loading) {
    return (
      <Chip
        icon={<CircularProgress size={16} aria-label="Loading conflicts…" />}
        label="Checking conflicts…"
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
        label="No scheduling conflicts"
        color="success"
        variant="outlined"
        aria-label="No scheduling conflicts"
        sx={{ minHeight: 32 }}
      />
    );
  }

  return (
    <>
      <Chip
        ref={anchorRef}
        icon={<Warning />}
        label={`${count} scheduling conflict${count === 1 ? '' : 's'} — click to see details`}
        color="error"
        variant="outlined"
        onClick={() => setPopoverOpen(true)}
        aria-label={`${count} scheduling conflict${count === 1 ? '' : 's'} — click to see details`}
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
