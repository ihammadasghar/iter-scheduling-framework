import { Box, Stack, Typography } from '@mui/material';
import AddedClassCard from '@/molecules/AddedClassCard';
import RemovedClassCard from '@/molecules/RemovedClassCard';
import ChangeCard from '@/molecules/ChangeCard';
import { buildClassChanges } from '@/utils/buildClassChanges';
import type { ScheduleDiff } from '@/types';
import type { ScheduleNames } from '@/utils/scheduleNames';

interface ClassDiffPanelProps {
  readonly classDiff: ScheduleDiff;
  readonly names: ScheduleNames;
}

export default function ClassDiffPanel({ classDiff, names }: ClassDiffPanelProps): React.ReactElement {
  const { added, removed } = classDiff;
  const changes = buildClassChanges(classDiff.changed, names);
  const isEmpty = added.length === 0 && removed.length === 0 && changes.length === 0;

  if (isEmpty) {
    return (
      <Typography variant="body2" color="text.secondary">
        No changes detected in this proposal.
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      {added.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="success.dark" gutterBottom>
            New Classes ({added.length})
          </Typography>
          {added.map((c) => (
            <AddedClassCard key={c.id} classItem={c} names={names} />
          ))}
        </Box>
      )}

      {removed.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="error.dark" gutterBottom>
            Removed Classes ({removed.length})
          </Typography>
          {removed.map((c) => (
            <RemovedClassCard key={c.id} classItem={c} names={names} />
          ))}
        </Box>
      )}

      {changes.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Changed Classes ({changes.length})
          </Typography>
          {changes.map((change) => (
            <ChangeCard key={change.classId} change={change} />
          ))}
        </Box>
      )}
    </Stack>
  );
}
