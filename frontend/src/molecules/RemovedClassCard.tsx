import { Box, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { RawClass } from '@/types';
import type { ScheduleNames } from '@/utils/scheduleNames';

const messages = defineMessages({
  removed: {
    id: 'removedClassCard.removed',
    defaultMessage: 'Removed',
  },
  summary: {
    id: 'removedClassCard.summary',
    defaultMessage: '{course} · {professor} · {room} · {time} · {group}',
  },
  emptyTime: {
    id: 'removedClassCard.emptyTime',
    defaultMessage: '—',
  },
});

interface RemovedClassCardProps {
  readonly classItem: RawClass;
  readonly names: ScheduleNames;
}

export default function RemovedClassCard({ classItem, names }: RemovedClassCardProps): React.ReactElement {
  const intl = useIntl();
  const timeLabel = [...classItem.timeSlotIds].map(formatTimeSlotFull).join(', ') || intl.formatMessage(messages.emptyTime);

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: 'error.main', borderWidth: 1.5 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label={intl.formatMessage(messages.removed)} size="small" color="error" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, textDecoration: 'line-through' }}>
            {classItem.title}
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.summary, {
            course: names.courseName(classItem.courseId),
            professor: names.professorName(classItem.professorId),
            room: names.roomName(classItem.roomId),
            time: timeLabel,
            group: names.groupName(classItem.studentGroupId),
          })}
        </Typography>
      </CardContent>
    </Card>
  );
}
