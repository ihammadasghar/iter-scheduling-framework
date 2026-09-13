import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearStaleDraft } from '@/store/reducers/proposalSlice';
import { rebaseSimulationThunk } from '@/store/reducers/simulationSlice';

const messages = defineMessages({
  title: {
    id: 'scheduleUpdatedModal.title',
    defaultMessage: '📋 The published schedule has changed',
  },
  body: {
    id: 'scheduleUpdatedModal.body',
    defaultMessage: "While you were working on this draft, the scheduling office published updates to the live timetable. Update your draft so it's compared against the latest version before submitting.",
  },
  updating: {
    id: 'scheduleUpdatedModal.updating',
    defaultMessage: 'Updating…',
  },
  updateDraft: {
    id: 'scheduleUpdatedModal.updateDraft',
    defaultMessage: 'Update My Draft →',
  },
  cancel: {
    id: 'scheduleUpdatedModal.cancel',
    defaultMessage: 'Cancel',
  },
  confirmation: {
    id: 'scheduleUpdatedModal.confirmation',
    defaultMessage: 'Your draft has been updated with the latest published schedule — review your changes and submit again.',
  },
});

// Shown when a proposal submission is rejected because the published
// schedule changed since the draft was created (backend code
// MAIN_SCHEDULE_CHANGED — see proposalSlice's staleDraft state). Offers to
// update the draft onto the latest published schedule rather than leaving
// the user with just a plain error. Mirrors SessionExpiryModal's shape:
// a non-dismissable Dialog with two full-width stacked actions, driven by
// Redux state rather than local component state.
export default function ScheduleUpdatedModal(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const staleDraft = useAppSelector((s) => s.proposal.staleDraft);
  const simulation = useAppSelector((s) =>
    staleDraft ? s.simulation.simulations.find((sim) => sim.id === staleDraft.simulationId) : undefined,
  );

  const [updating, setUpdating] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const handleCancel = (): void => {
    dispatch(clearStaleDraft());
  };

  const handleUpdate = async (): Promise<void> => {
    if (!staleDraft || !simulation) {
      // Nothing to rebase from (e.g. the draft's local record went missing)
      // — fall back to just dismissing so the user isn't stuck.
      dispatch(clearStaleDraft());
      return;
    }

    setUpdating(true);
    const result = await dispatch(
      rebaseSimulationThunk({
        simulationId: staleDraft.simulationId,
        baseScheduleVersion: simulation.baseScheduleVersion,
      }),
    );
    setUpdating(false);
    dispatch(clearStaleDraft());

    // On failure, the rejection is already surfaced via the global error
    // snackbar (state.simulation.error) — nothing more to do here.
    if (rebaseSimulationThunk.fulfilled.match(result)) {
      setConfirmationOpen(true);
    }
  };

  return (
    <>
      <Dialog
        open={staleDraft !== null}
        onClose={(_event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        }}
        aria-labelledby="schedule-updated-title"
        aria-describedby="schedule-updated-desc"
      >
        <DialogTitle id="schedule-updated-title">{intl.formatMessage(messages.title)}</DialogTitle>
        <DialogContent>
          <DialogContentText id="schedule-updated-desc">
            {intl.formatMessage(messages.body)}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 1, p: 3 }}>
          <Button
            variant="contained"
            onClick={() => void handleUpdate()}
            disabled={updating}
            fullWidth
          >
            {updating ? intl.formatMessage(messages.updating) : intl.formatMessage(messages.updateDraft)}
          </Button>
          <Button variant="outlined" onClick={handleCancel} disabled={updating} fullWidth>
            {intl.formatMessage(messages.cancel)}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={confirmationOpen}
        autoHideDuration={8000}
        onClose={() => setConfirmationOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setConfirmationOpen(false)} sx={{ width: '100%' }}>
          {intl.formatMessage(messages.confirmation)}
        </Alert>
      </Snackbar>
    </>
  );
}
