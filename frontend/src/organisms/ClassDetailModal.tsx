import { Box, Button, Dialog, DialogContent, IconButton, Tooltip, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import ClassDetailSection from '@/molecules/ClassDetailSection';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleClass } from '@/types';

const messages = defineMessages({
  dialogAriaLabel: {
    id: 'classDetailModal.dialogAriaLabel',
    defaultMessage: 'Class details',
  },
  classDetails: {
    id: 'classDetailModal.classDetails',
    defaultMessage: 'Class Details',
  },
  closeDialog: {
    id: 'classDetailModal.closeDialog',
    defaultMessage: 'Close',
  },
  editInSimulation: {
    id: 'classDetailModal.editInSimulation',
    defaultMessage: 'Propose a Change',
  },
  editInSimulationSubtext: {
    id: 'classDetailModal.editInSimulationSubtext',
    defaultMessage: 'Draft your improvement to this schedule and send it as a proposal to the scheduling office.',
  },
});

interface ClassDetailModalProps {
  readonly open: boolean;
  readonly classItem?: ScheduleClass;
  readonly onClose: () => void;
  readonly onEditInSimulation: () => void;
}

// Dashboard counterpart to Inspector.tsx's slide-in panel — same header +
// ClassDetailSection composition, but as a popup Dialog since the dashboard
// has no simulation workspace to anchor a persistent side panel to. Stays
// mounted with `open` passed straight through (not additionally gated on
// `classItem`) so the MUI close transition can play out: deselectClass()
// nulls both selectedClassId and inspectorOpen in the same dispatch, so by
// the render that's supposed to be fading out, classItem is already gone.
export default function ClassDetailModal({
  open,
  classItem,
  onClose,
  onEditInSimulation,
}: ClassDetailModalProps): React.ReactElement {
  const intl = useIntl();
  const { courseName } = useScheduleNames();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-label={intl.formatMessage(messages.dialogAriaLabel)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, pt: 2 }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {classItem !== undefined ? (
            <>
              <Typography variant="h4" component="h2" noWrap>
                {courseName(classItem.courseId)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {classItem.title}
              </Typography>
            </>
          ) : (
            <Typography variant="h4" component="h2">
              {intl.formatMessage(messages.classDetails)}
            </Typography>
          )}
        </Box>
        <Tooltip title={intl.formatMessage(messages.closeDialog)}>
          <IconButton
            onClick={onClose}
            aria-label={intl.formatMessage(messages.closeDialog)}
            edge="end"
          >
            <Close />
          </IconButton>
        </Tooltip>
      </Box>

      {classItem !== undefined && (
        <DialogContent>
          <ClassDetailSection classItem={classItem} />

          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={onEditInSimulation}>
              {intl.formatMessage(messages.editInSimulation)}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {intl.formatMessage(messages.editInSimulationSubtext)}
            </Typography>
          </Box>
        </DialogContent>
      )}
    </Dialog>
  );
}
