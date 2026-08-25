import { Alert, Box, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import HealthSummaryTile from '@/molecules/HealthSummaryTile';
import ConflictBreakdownChart from '@/molecules/ConflictBreakdownChart';
import { groupConflictsByType } from '@/utils/groupConflictsByType';
import type { Conflict, ConflictDelta } from '@/types';

interface ConflictsComparisonPanelProps {
  readonly baselineConflicts: readonly Conflict[];
  readonly candidateConflicts: readonly Conflict[];
  readonly conflictDelta: ConflictDelta;
}

interface ConflictListProps {
  readonly title: string;
  readonly conflicts: readonly Conflict[];
}

function ConflictList({ title, conflicts }: ConflictListProps): React.ReactElement {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {title} ({conflicts.length})
      </Typography>
      <List dense disablePadding>
        {conflicts.map((c) => (
          <ListItem key={c.id} disablePadding>
            <ListItemText primary={c.message} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default function ConflictsComparisonPanel({
  baselineConflicts,
  candidateConflicts,
  conflictDelta,
}: ConflictsComparisonPanelProps): React.ReactElement {
  const baselineCounts = groupConflictsByType(baselineConflicts);
  const candidateCounts = groupConflictsByType(candidateConflicts);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Currently Published
          </Typography>
          <HealthSummaryTile conflictCount={baselineConflicts.length} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This Proposal
          </Typography>
          <HealthSummaryTile conflictCount={candidateConflicts.length} />
        </Box>
      </Stack>

      {(conflictDelta.added.length > 0 || conflictDelta.resolved.length > 0) && (
        <Alert severity={conflictDelta.added.length > 0 ? 'warning' : 'success'}>
          {conflictDelta.added.length > 0 &&
            `${conflictDelta.added.length} new conflict${conflictDelta.added.length === 1 ? '' : 's'} introduced. `}
          {conflictDelta.resolved.length > 0 &&
            `${conflictDelta.resolved.length} conflict${conflictDelta.resolved.length === 1 ? '' : 's'} resolved.`}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Conflicts by Type — Published
          </Typography>
          <ConflictBreakdownChart counts={baselineCounts} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Conflicts by Type — This Proposal
          </Typography>
          <ConflictBreakdownChart counts={candidateCounts} />
        </Box>
      </Stack>

      {conflictDelta.added.length > 0 && (
        <ConflictList title="Newly Introduced Conflicts" conflicts={conflictDelta.added} />
      )}
      {conflictDelta.resolved.length > 0 && (
        <ConflictList title="Resolved Conflicts" conflicts={conflictDelta.resolved} />
      )}
    </Stack>
  );
}
