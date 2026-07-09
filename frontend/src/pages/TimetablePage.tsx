import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import AppShell from '@/templates/AppShell';
import TimetableGrid from '@/organisms/TimetableGrid';
import Inspector from '@/organisms/Inspector';
import HUD from '@/organisms/HUD';
import SubmitProposalModal from '@/organisms/SubmitProposalModal';
import ViewBySelector from '@/molecules/ViewBySelector';
import SaveChangesButton from '@/molecules/SaveChangesButton';
import { useAppDispatch } from '@/store/hooks';
import { setSession } from '@/store/reducers/sessionSlice';
import { fetchClassesPage, resetClasses } from '@/store/reducers/classSlice';

const PAGE_SIZE = 50; // must match PAGE_SIZE in classSlice

export default function TimetablePage(): React.ReactElement {
  const { id: simId } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const [submitOpen, setSubmitOpen] = useState(false);

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

        {/* Main area: grid + inspector overlay */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          <TimetableGrid />
          <Inspector simId={simId} />
        </Box>

        {/* HUD — bottom bar with live conflicts + metrics */}
        <HUD simId={simId} onSubmitProposal={() => setSubmitOpen(true)} />
      </Box>

      {/* Submit Proposal Modal — rendered outside the main layout so Snackbar persists */}
      <SubmitProposalModal
        open={submitOpen}
        simId={simId}
        onClose={() => setSubmitOpen(false)}
      />
    </AppShell>
  );
}
