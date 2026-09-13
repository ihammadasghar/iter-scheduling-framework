import { Box, Skeleton } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  ariaLabel: {
    id: 'gridSkeleton.ariaLabel',
    defaultMessage: 'Loading timetable…',
  },
});

const SKELETON_ROWS = 4;
const SKELETON_COLS = 6;

/**
 * Placeholder grid shown while the class list is loading.
 */
export default function GridSkeleton(): React.ReactElement {
  const intl = useIntl();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `100px repeat(${SKELETON_COLS}, minmax(140px, 1fr))`,
        gap: '1px',
        bgcolor: 'divider',
        overflow: 'hidden',
        borderRadius: 1,
      }}
      aria-label={intl.formatMessage(messages.ariaLabel)}
    >
      {/* Header row */}
      <Skeleton variant="rectangular" height={48} sx={{ bgcolor: 'background.paper' }} />
      {Array.from({ length: SKELETON_COLS }).map((_, i) => (
        <Skeleton
          key={`hdr-${i}`}
          variant="rectangular"
          height={48}
          sx={{ bgcolor: 'background.paper' }}
        />
      ))}

      {/* Data rows */}
      {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
        <>
          <Skeleton
            key={`lbl-${row}`}
            variant="rectangular"
            height={72}
            sx={{ bgcolor: 'background.paper' }}
          />
          {Array.from({ length: SKELETON_COLS }).map((_, col) =>
            (row + col) % 3 === 0 ? (
              <Box
                key={`cell-${row}-${col}`}
                sx={{ bgcolor: 'background.paper', p: 1, display: 'flex', alignItems: 'center' }}
              >
                <Skeleton variant="rounded" width={120} height={32} />
              </Box>
            ) : (
              <Box key={`empty-${row}-${col}`} sx={{ bgcolor: 'background.paper', height: 72 }} />
            ),
          )}
        </>
      ))}
    </Box>
  );
}
