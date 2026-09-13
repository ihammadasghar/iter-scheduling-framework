import { Alert, Box, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import HealthSummaryTile from '@/molecules/HealthSummaryTile';
import ConflictBreakdownChart from '@/molecules/ConflictBreakdownChart';
import { groupConflictsByType, isPolicyViolation } from '@/utils/groupConflictsByType';
import type { Conflict, ConflictDelta } from '@/types';

const messages = defineMessages({
  currentlyPublished: {
    id: 'conflictsComparisonPanel.currentlyPublished',
    defaultMessage: 'Currently Published',
  },
  thisProposal: {
    id: 'conflictsComparisonPanel.thisProposal',
    defaultMessage: 'This Proposal',
  },
  newConflictsIntroduced: {
    id: 'conflictsComparisonPanel.newConflictsIntroduced',
    defaultMessage: '{count, plural, one {# new conflict introduced. } other {# new conflicts introduced. }}',
  },
  conflictsResolved: {
    id: 'conflictsComparisonPanel.conflictsResolved',
    defaultMessage: '{count, plural, one {# conflict resolved.} other {# conflicts resolved.}}',
  },
  conflictsByTypePublished: {
    id: 'conflictsComparisonPanel.conflictsByTypePublished',
    defaultMessage: 'Conflicts by Type — Published',
  },
  conflictsByTypeProposal: {
    id: 'conflictsComparisonPanel.conflictsByTypeProposal',
    defaultMessage: 'Conflicts by Type — This Proposal',
  },
  newlyIntroduced: {
    id: 'conflictsComparisonPanel.newlyIntroduced',
    defaultMessage: 'Newly Introduced Conflicts',
  },
  resolved: {
    id: 'conflictsComparisonPanel.resolved',
    defaultMessage: 'Resolved Conflicts',
  },
  listTitle: {
    id: 'conflictsComparisonPanel.listTitle',
    defaultMessage: '{title} ({count})',
  },
  institutionRuleViolated: {
    id: 'conflictsComparisonPanel.institutionRuleViolated',
    defaultMessage: 'Institution rule violated: {message}',
  },
});

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
  const intl = useIntl();
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {intl.formatMessage(messages.listTitle, { title, count: conflicts.length })}
      </Typography>
      <List dense disablePadding>
        {conflicts.map((c) => (
          <ListItem key={c.id} disablePadding>
            <ListItemText
              primary={isPolicyViolation(c.type) ? intl.formatMessage(messages.institutionRuleViolated, { message: c.message }) : c.message}
            />
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
  const intl = useIntl();
  const baselineCounts = groupConflictsByType(intl, baselineConflicts);
  const candidateCounts = groupConflictsByType(intl, candidateConflicts);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.currentlyPublished)}
          </Typography>
          <HealthSummaryTile conflictCount={baselineConflicts.length} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.thisProposal)}
          </Typography>
          <HealthSummaryTile conflictCount={candidateConflicts.length} />
        </Box>
      </Stack>

      {(conflictDelta.added.length > 0 || conflictDelta.resolved.length > 0) && (
        <Alert severity={conflictDelta.added.length > 0 ? 'warning' : 'success'}>
          {conflictDelta.added.length > 0 &&
            intl.formatMessage(messages.newConflictsIntroduced, { count: conflictDelta.added.length })}
          {conflictDelta.resolved.length > 0 &&
            intl.formatMessage(messages.conflictsResolved, { count: conflictDelta.resolved.length })}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.conflictsByTypePublished)}
          </Typography>
          <ConflictBreakdownChart counts={baselineCounts} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.conflictsByTypeProposal)}
          </Typography>
          <ConflictBreakdownChart counts={candidateCounts} />
        </Box>
      </Stack>

      {conflictDelta.added.length > 0 && (
        <ConflictList title={intl.formatMessage(messages.newlyIntroduced)} conflicts={conflictDelta.added} />
      )}
      {conflictDelta.resolved.length > 0 && (
        <ConflictList title={intl.formatMessage(messages.resolved)} conflicts={conflictDelta.resolved} />
      )}
    </Stack>
  );
}
