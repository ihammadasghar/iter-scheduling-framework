import { Box, Card, CardContent, Chip, Divider, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { RawClass } from '@/types';
import type { ScheduleNames } from '@/utils/scheduleNames';

const messages = defineMessages({
  new: {
    id: 'addedClassCard.new',
    defaultMessage: 'New',
  },
  summary: {
    id: 'addedClassCard.summary',
    defaultMessage: '{course} · {professor} · {room} · {time} · {group}',
  },
  emptyTime: {
    id: 'addedClassCard.emptyTime',
    defaultMessage: '—',
  },
});

interface AddedClassCardProps {
  readonly classItem: RawClass;
  readonly names: ScheduleNames;
}

export default function AddedClassCard({ classItem, names }: AddedClassCardProps): React.ReactElement {
  const intl = useIntl();
  const timeLabel = [...classItem.timeSlotIds].map(formatTimeSlotFull).join(', ') || intl.formatMessage(messages.emptyTime);

  return (
    <Card variant="outlined" sx={{ mb: 2, borderColor: 'success.main', borderWidth: 1.5 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip label={intl.formatMessage(messages.new)} size="small" color="success" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
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
