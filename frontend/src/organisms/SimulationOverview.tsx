import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppSelector } from '@/store/hooks';
import GridSkeleton from '@/organisms/GridSkeleton';
import RoomUtilisationHeatmap from '@/organisms/RoomUtilisationHeatmap';
import HealthSummaryTile from '@/molecules/HealthSummaryTile';
import MetricTileRow from '@/molecules/MetricTileRow';
import ConflictBreakdownChart from '@/molecules/ConflictBreakdownChart';
import { aggregateOccupancy } from '@/utils/aggregateOccupancy';
import { groupConflictsByType } from '@/utils/groupConflictsByType';
import { sortTimeSlotIds, uniqueSorted } from '@/utils/scheduleFormatters';
import type { ConflictType } from '@/types';

const messages = defineMessages({
  emptyMessage: {
    id: 'simulationOverview.emptyMessage',
    defaultMessage: 'Nothing to show yet — add classes to see utilisation and conflicts here.',
  },
  goToGridView: {
    id: 'simulationOverview.goToGridView',
    defaultMessage: 'Back to Schedule',
  },
  roomDataError: {
    id: 'simulationOverview.roomDataError',
    defaultMessage: "Couldn't load room data for this draft — try refreshing the page.",
  },
  conflictsByType: {
    id: 'simulationOverview.conflictsByType',
    defaultMessage: 'Conflicts by Type',
  },
  metrics: {
    id: 'simulationOverview.metrics',
    defaultMessage: 'Metrics',
  },
});

interface SimulationOverviewProps {
  readonly onGoToGridView: () => void;
  readonly onSelectConflictType: (type: ConflictType) => void;
}

export default function SimulationOverview({
  onGoToGridView,
  onSelectConflictType,
}: SimulationOverviewProps): React.ReactElement {
  const intl = useIntl();
  const classes = useAppSelector((s) => s.class.classes);
  const classesLoading = useAppSelector((s) => s.class.loading);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const metrics = useAppSelector((s) => s.metric.metrics);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const scheduleLoading = useAppSelector((s) => s.schedule.loading);
  const scheduleError = useAppSelector((s) => s.schedule.error);

  if ((classesLoading || scheduleLoading) && classes.length === 0) {
    return <GridSkeleton />;
  }

  if (classes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ mb: 2 }}>
          {intl.formatMessage(messages.emptyMessage)}
        </Typography>
        <Button variant="contained" onClick={onGoToGridView}>
          {intl.formatMessage(messages.goToGridView)}
        </Button>
      </Box>
    );
  }

  const sortedTimeSlotIds = sortTimeSlotIds(uniqueSorted(classes.flatMap((c) => [...c.timeSlotIds])));
  const occupancy = aggregateOccupancy(classes, rooms, studentGroups);
  const conflictCounts = groupConflictsByType(intl, conflicts);

  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <HealthSummaryTile conflictCount={conflicts.length} />
      {scheduleError && (
        <Alert severity="error">
          {intl.formatMessage(messages.roomDataError)}
        </Alert>
      )}
      <RoomUtilisationHeatmap
        occupancy={occupancy}
        rooms={rooms}
        sortedTimeSlotIds={sortedTimeSlotIds}
        classes={classes}
      />
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          {intl.formatMessage(messages.conflictsByType)}
        </Typography>
        <ConflictBreakdownChart counts={conflictCounts} onBarClick={onSelectConflictType} />
      </Box>
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          {intl.formatMessage(messages.metrics)}
        </Typography>
        <MetricTileRow metrics={metrics} />
      </Box>
    </Stack>
  );
}
