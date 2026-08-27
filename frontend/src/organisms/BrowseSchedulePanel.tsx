import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import ResourcePicker from '@/molecules/ResourcePicker';
import MyScheduleCalendar from '@/organisms/MyScheduleCalendar';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ViewByOption } from '@/types';

interface BrowseSchedulePanelProps {
  readonly conflictedClassIds?: ReadonlySet<string>;
  // Forwarded straight to MyScheduleCalendar — see its own prop doc.
  readonly excludedDays?: ReadonlyMap<string, string>;
}

const nameResolverFor = (
  names: ReturnType<typeof useScheduleNames>,
  type: ViewByOption,
): ((id: string) => string) => {
  if (type === 'room') return names.roomName;
  if (type === 'professor') return names.professorName;
  return names.groupName;
};

/**
 * The "Browse" tab: search for any specific room, professor, or student
 * group and see just their weekly calendar — the counterpart to "My
 * Schedule" (which is always the signed-in person) and "Full Schedule"
 * (which is always everyone at once). Shared verbatim between the
 * simulation workspace (TimetablePage) and the read-only published schedule
 * (PublishedSchedulePage) — it's pure presentation over whichever class
 * list/roster the calling page has already loaded into Redux.
 */
export default function BrowseSchedulePanel({
  conflictedClassIds,
  excludedDays,
}: BrowseSchedulePanelProps): React.ReactElement {
  const [resourceType, setResourceType] = useState<ViewByOption>('room');
  const [resourceId, setResourceId] = useState<string | null>(null);
  const names = useScheduleNames();

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <ResourcePicker
          resourceType={resourceType}
          onResourceTypeChange={setResourceType}
          resourceId={resourceId}
          onResourceIdChange={setResourceId}
        />
      </Box>

      {resourceId === null ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
          <Typography color="text.secondary">
            Search for a room, professor, or student group to see their weekly schedule.
          </Typography>
        </Box>
      ) : (
        <MyScheduleCalendar
          resource={{ type: resourceType, id: resourceId }}
          conflictedClassIds={conflictedClassIds}
          excludedDays={excludedDays}
          emptyMessage={`No classes are scheduled for ${nameResolverFor(names, resourceType)(resourceId)} this week.`}
        />
      )}
    </Box>
  );
}
