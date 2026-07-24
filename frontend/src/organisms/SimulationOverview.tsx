import { Box, Button, Stack, Typography } from '@mui/material';
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

interface SimulationOverviewProps {
  readonly onGoToGridView: () => void;
  readonly onSelectConflictType: (type: ConflictType) => void;
}

export default function SimulationOverview({
  onGoToGridView,
  onSelectConflictType,
}: SimulationOverviewProps): React.ReactElement {
  const classes = useAppSelector((s) => s.class.classes);
  const classesLoading = useAppSelector((s) => s.class.loading);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const metrics = useAppSelector((s) => s.metric.metrics);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const scheduleLoading = useAppSelector((s) => s.schedule.loading);

  if ((classesLoading || scheduleLoading) && classes.length === 0) {
    return <GridSkeleton />;
  }

  if (classes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ mb: 2 }}>
          Nothing to show yet — add classes in Grid View to see utilisation and conflicts here.
        </Typography>
        <Button variant="contained" onClick={onGoToGridView}>
          Go to Grid View
        </Button>
      </Box>
    );
  }

  const sortedTimeSlotIds = sortTimeSlotIds(uniqueSorted(classes.flatMap((c) => [...c.timeSlotIds])));
  const occupancy = aggregateOccupancy(classes, rooms, studentGroups);
  const conflictCounts = groupConflictsByType(conflicts);

  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <HealthSummaryTile conflictCount={conflicts.length} />
      <RoomUtilisationHeatmap
        occupancy={occupancy}
        rooms={rooms}
        sortedTimeSlotIds={sortedTimeSlotIds}
        classes={classes}
      />
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          Conflicts by Type
        </Typography>
        <ConflictBreakdownChart counts={conflictCounts} onBarClick={onSelectConflictType} />
      </Box>
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          Metrics
        </Typography>
        <MetricTileRow metrics={metrics} />
      </Box>
    </Stack>
  );
}
