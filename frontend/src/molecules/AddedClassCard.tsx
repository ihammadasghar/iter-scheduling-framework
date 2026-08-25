import { Box, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { RawClass } from '@/types';
import type { ScheduleNames } from '@/utils/scheduleNames';

interface AddedClassCardProps {
  readonly classItem: RawClass;
  readonly names: ScheduleNames;
}

export default function AddedClassCard({ classItem, names }: AddedClassCardProps): React.ReactElement {
  const timeLabel = [...classItem.timeSlotIds].map(formatTimeSlotFull).join(', ') || '—';

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: 'success.main', borderWidth: 1.5 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label="New" size="small" color="success" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {classItem.title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="body2" color="text.secondary">
          {names.courseName(classItem.courseId)} · {names.professorName(classItem.professorId)} ·{' '}
          {names.roomName(classItem.roomId)} · {timeLabel} · {names.groupName(classItem.studentGroupId)}
        </Typography>
      </CardContent>
    </Card>
  );
}
