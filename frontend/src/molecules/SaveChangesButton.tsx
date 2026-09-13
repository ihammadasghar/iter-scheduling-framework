import { useState } from 'react';
import { Box, Button, CircularProgress, Snackbar, Tooltip } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { commitSimulationThunk } from '@/store/reducers/classSlice';
import { setHasUnsavedChanges } from '@/store/reducers/sessionSlice';

const messages = defineMessages({
  tooltip: {
    id: 'saveChangesButton.tooltip',
    defaultMessage: 'Saves your current changes to your draft so they are not lost.',
  },
  saveAriaLabel: {
    id: 'saveChangesButton.saveAriaLabel',
    defaultMessage: 'Save changes to draft',
  },
  saving: {
    id: 'saveChangesButton.saving',
    defaultMessage: 'Saving…',
  },
  saveChanges: {
    id: 'saveChangesButton.saveChanges',
    defaultMessage: 'Save Changes',
  },
  draftSaved: {
    id: 'saveChangesButton.draftSaved',
    defaultMessage: 'Draft saved ✓',
  },
});

interface SaveChangesButtonProps {
  readonly simId: string;
}

export default function SaveChangesButton({ simId }: SaveChangesButtonProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const hasUnsavedChanges = useAppSelector((s) => s.session.hasUnsavedChanges);
  const [loading, setLoading] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

  const handleSave = async (): Promise<void> => {
    setLoading(true);
    const result = await dispatch(commitSimulationThunk(simId));
    setLoading(false);

    if (commitSimulationThunk.fulfilled.match(result)) {
      dispatch(setHasUnsavedChanges(false));
      setSnackOpen(true);
    }
  };

  return (
    <>
      <Tooltip title={intl.formatMessage(messages.tooltip)}>
        <Box component="span">
          <Button
            variant="contained"
            disabled={!hasUnsavedChanges || loading}
            onClick={() => void handleSave()}
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />
            }
            aria-label={intl.formatMessage(messages.saveAriaLabel)}
          >
            {loading ? intl.formatMessage(messages.saving) : intl.formatMessage(messages.saveChanges)}
          </Button>
        </Box>
      </Tooltip>

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        message={intl.formatMessage(messages.draftSaved)}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
