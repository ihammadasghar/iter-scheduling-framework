import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearSession } from '@/store/reducers/sessionSlice';
import { deleteSimulationThunk } from '@/store/reducers/simulationSlice';
import CreateSimulationDialog from '@/molecules/CreateSimulationDialog';

const messages = defineMessages({
  title: {
    id: 'sessionExpiryModal.title',
    defaultMessage: '⏱ Your session has ended',
  },
  body: {
    id: 'sessionExpiryModal.body',
    defaultMessage: "You were away for a while and your editing session has closed automatically. Don't worry — any changes you saved are still there on your draft. Only unsaved changes from this session were lost.",
  },
  goHome: {
    id: 'sessionExpiryModal.goHome',
    defaultMessage: 'Go Back to My Simulations',
  },
  newDraft: {
    id: 'sessionExpiryModal.newDraft',
    defaultMessage: 'Start a New Draft',
  },
});

export default function SessionExpiryModal(): React.ReactElement {
  const intl = useIntl();
  const expired = useAppSelector((s) => s.session.expired);
  const simulationId = useAppSelector((s) => s.session.simulationId);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  // The backend session behind this draft is already confirmed gone (that's
  // why this modal is open) — drop it from the dashboard's localStorage list
  // too, so the user doesn't land back on the same dead card. Fire-and-forget:
  // simulationService.deleteSimulation() already treats a 404 as success.
  const forgetStaleDraft = (): void => {
    if (simulationId) void dispatch(deleteSimulationThunk(simulationId));
  };

  const handleGoHome = (): void => {
    forgetStaleDraft();
    dispatch(clearSession());
    navigate('/');
  };

  const handleNewDraft = (): void => {
    forgetStaleDraft();
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
        <DialogTitle id="session-expiry-title">{intl.formatMessage(messages.title)}</DialogTitle>
        <DialogContent>
          <DialogContentText id="session-expiry-desc">
            {intl.formatMessage(messages.body)}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 1, p: 3 }}>
          <Button variant="contained" onClick={handleGoHome} fullWidth>
            {intl.formatMessage(messages.goHome)}
          </Button>
          <Button variant="outlined" onClick={handleNewDraft} fullWidth>
            {intl.formatMessage(messages.newDraft)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* CreateSimulationDialog — opened when user clicks "Start a New Draft" */}
      <CreateSimulationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
