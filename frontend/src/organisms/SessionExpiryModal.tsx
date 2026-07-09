import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearSession } from '@/store/reducers/sessionSlice';
import CreateSimulationDialog from '@/molecules/CreateSimulationDialog';

export default function SessionExpiryModal(): React.ReactElement {
  const expired = useAppSelector((s) => s.session.expired);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const handleGoHome = (): void => {
    dispatch(clearSession());
    navigate('/');
  };

  const handleNewDraft = (): void => {
    dispatch(clearSession());
    setCreateOpen(true);
  };

  return (
    <>
      <Dialog
        open={expired}
        // Non-dismissable: ignore both ESC and backdrop-click reasons
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        }}
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-desc"
      >
        <DialogTitle id="session-expiry-title">⏱ Your session has ended</DialogTitle>
        <DialogContent>
          <DialogContentText id="session-expiry-desc">
            You were away for a while and your editing session has closed automatically. Don&rsquo;t
            worry — any changes you saved are still there on your draft. Only unsaved changes from
            this session were lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 1, p: 3 }}>
          <Button variant="contained" onClick={handleGoHome} fullWidth>
            Go Back to My Simulations
          </Button>
          <Button variant="outlined" onClick={handleNewDraft} fullWidth>
            Start a New Draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* CreateSimulationDialog — opened when user clicks "Start a New Draft" */}
      <CreateSimulationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
