import { Box, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import AddedClassCard from '@/molecules/AddedClassCard';
import RemovedClassCard from '@/molecules/RemovedClassCard';
import ChangeCard from '@/molecules/ChangeCard';
import { buildClassChanges } from '@/utils/buildClassChanges';
import type { ScheduleDiff } from '@/types';
import type { ScheduleNames } from '@/utils/scheduleNames';

const messages = defineMessages({
  noChanges: {
    id: 'classDiffPanel.noChanges',
    defaultMessage: 'No changes detected in this proposal.',
  },
  newClasses: {
    id: 'classDiffPanel.newClasses',
    defaultMessage: 'New Classes ({count})',
  },
  removedClasses: {
    id: 'classDiffPanel.removedClasses',
    defaultMessage: 'Removed Classes ({count})',
  },
  changedClasses: {
    id: 'classDiffPanel.changedClasses',
    defaultMessage: 'Changed Classes ({count})',
  },
});

interface ClassDiffPanelProps {
  readonly classDiff: ScheduleDiff;
  readonly names: ScheduleNames;
}

export default function ClassDiffPanel({ classDiff, names }: ClassDiffPanelProps): React.ReactElement {
  const intl = useIntl();
  const { added, removed } = classDiff;
  const changes = buildClassChanges(intl, classDiff.changed, names);
  const isEmpty = added.length === 0 && removed.length === 0 && changes.length === 0;

  if (isEmpty) {
    return (
      <Typography variant="body2" color="text.secondary">
        {intl.formatMessage(messages.noChanges)}
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      {added.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="success.dark" gutterBottom>
            {intl.formatMessage(messages.newClasses, { count: added.length })}
          </Typography>
          {added.map((c) => (
            <AddedClassCard key={c.id} classItem={c} names={names} />
          ))}
        </Box>
      )}

      {removed.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="error.dark" gutterBottom>
            {intl.formatMessage(messages.removedClasses, { count: removed.length })}
          </Typography>
          {removed.map((c) => (
            <RemovedClassCard key={c.id} classItem={c} names={names} />
          ))}
        </Box>
      )}

      {changes.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.changedClasses, { count: changes.length })}
          </Typography>
          {changes.map((change) => (
            <ChangeCard key={change.classId} change={change} />
          ))}
        </Box>
      )}
    </Stack>
  );
}
