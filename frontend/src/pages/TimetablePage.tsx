import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import AppShell from '@/templates/AppShell';
import TimetableGrid from '@/organisms/TimetableGrid';
import ViewBySelector from '@/molecules/ViewBySelector';
import SaveChangesButton from '@/molecules/SaveChangesButton';
import { useAppDispatch } from '@/store/hooks';
import { setSession } from '@/store/reducers/sessionSlice';
import { fetchClassesPage, resetClasses } from '@/store/reducers/classSlice';

const PAGE_SIZE = 50; // must match PAGE_SIZE in classSlice

export default function TimetablePage(): React.ReactElement {
  const { id: simId } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  // On mount: set session context and eagerly load all class pages
  useEffect(() => {
    if (!simId) return;
    dispatch(resetClasses());
    dispatch(setSession(simId));

    const loadAll = async (): Promise<void> => {
      let page = 1;
      let more = true;
      while (more) {
        const result = await dispatch(fetchClassesPage({ simId, page }));
        if (fetchClassesPage.fulfilled.match(result)) {
          // more pages exist when a full page was returned
          more = result.payload.classes.length === PAGE_SIZE;
          page++;
        } else {
          break;
        }
      }
    };

    void loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId]);

  if (!simId) {
    return (
      <AppShell>
        <Box sx={{ p: 4 }}>
          <Typography color="error">No simulation ID provided.</Typography>
        </Box>
      </AppShell>
    );
  }

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
          <ViewBySelector />
          <Box sx={{ flex: 1 }} />
          <SaveChangesButton simId={simId} />
        </Box>

        {/* Main grid — fills remaining height */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <TimetableGrid />
        </Box>

        {/* HUD placeholder (Task 10) */}
        <Box
          sx={{
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            px: 3,
            py: 1,
            bgcolor: 'background.paper',
          }}
          aria-label="Metrics and conflicts HUD"
        >
          <Typography variant="caption" color="text.secondary">
            Metrics &amp; Conflicts HUD — coming in Task 10
          </Typography>
        </Box>
      </Box>
    </AppShell>
  );
}
