import { Box, Skeleton } from '@mui/material';

const SKELETON_ROWS = 4;
const SKELETON_COLS = 6;

/**
 * Placeholder grid shown while the class list is loading.
 */
export default function GridSkeleton(): React.ReactElement {
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
      aria-label="Loading timetable…"
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
