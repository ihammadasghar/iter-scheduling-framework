import { Divider, List, ListItem, Typography, Box } from '@mui/material';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleClass } from '@/types';

interface ClassDetailSectionProps {
  readonly classItem: ScheduleClass;
}

interface DetailRowProps {
  readonly label: string;
  readonly value: string;
}

const DetailRow = ({ label, value }: DetailRowProps): React.ReactElement => (
  <ListItem disablePadding sx={{ display: 'flex', gap: 2, py: 1 }}>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ minWidth: 90, flexShrink: 0, fontSize: 14 }}
    >
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontSize: 16 }}>
      {value}
    </Typography>
  </ListItem>
);

export default function ClassDetailSection({
  classItem,
}: ClassDetailSectionProps): React.ReactElement {
  const { professorName, roomName } = useScheduleNames();
  const timeSlotLabels = [...classItem.timeSlotIds]
    .map(formatTimeSlotFull)
    .join(', ');

  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', px: 2, pt: 2 }}
      >
        Current Assignment
      </Typography>
      <Divider />
      <List disablePadding sx={{ px: 2 }}>
        <DetailRow label="Professor" value={professorName(classItem.professorId)} />
        <DetailRow label="Room" value={roomName(classItem.roomId)} />
        <DetailRow label="Time" value={timeSlotLabels || '—'} />
      </List>
    </Box>
  );
}
