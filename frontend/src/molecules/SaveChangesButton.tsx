import { useState } from 'react';
import { Box, Button, CircularProgress, Snackbar, Tooltip } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { commitSimulationThunk } from '@/store/reducers/classSlice';
import { setHasUnsavedChanges } from '@/store/reducers/sessionSlice';

interface SaveChangesButtonProps {
  readonly simId: string;
}

export default function SaveChangesButton({ simId }: SaveChangesButtonProps): React.ReactElement {
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
      <Tooltip title="Saves your current changes to your draft so they are not lost.">
        <Box component="span">
          <Button
            variant="contained"
            disabled={!hasUnsavedChanges || loading}
            onClick={() => void handleSave()}
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />
            }
            aria-label="Save changes to draft"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </Box>
      </Tooltip>

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        message="Draft saved ✓"
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
