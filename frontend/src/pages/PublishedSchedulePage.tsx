import { useEffect } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import AppShell from '@/templates/AppShell';
import BackButton from '@/atoms/BackButton';
import TimetableGrid from '@/organisms/TimetableGrid';
import Inspector from '@/organisms/Inspector';
import ViewBySelector from '@/molecules/ViewBySelector';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPublishedClassesPage, resetClasses } from '@/store/reducers/classSlice';

const PAGE_SIZE = 50; // must match PAGE_SIZE in classSlice

// Read-only view of the currently published (main) schedule — no simulation
// session, no editing affordances (no HUD/conflicts/metrics/score/submit,
// no heartbeat/inactivity tracking). Just "what does the live timetable
// look like right now".
export default function PublishedSchedulePage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.class.error);

  useEffect(() => {
    dispatch(resetClasses());

    const loadAll = async (): Promise<void> => {
      let page = 1;
      let more = true;
      while (more) {
        const result = await dispatch(fetchPublishedClassesPage({ page }));
        if (fetchPublishedClassesPage.fulfilled.match(result)) {
          more = result.payload.classes.length === PAGE_SIZE;
          page++;
        } else {
          break;
        }
      }
    };

    void loadAll();
  }, [dispatch]);

  return (
    <AppShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 3,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <BackButton />
          <Typography variant="h6" component="h1" sx={{ mr: 1 }}>
            Published Schedule
          </Typography>
          <ViewBySelector />
          <Box sx={{ flex: 1 }} />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
            Could not load the published schedule. Please try again.
          </Alert>
        )}

        {/* Main area: grid + inspector overlay (read-only — no simId) */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          <TimetableGrid />
          <Inspector />
        </Box>
      </Box>
    </AppShell>
  );
}
