import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deselectClass, toggleInspector } from '@/store/reducers/uiSlice';
import ClassDetailSection from '@/molecules/ClassDetailSection';
import InspectorSkeleton from '@/organisms/InspectorSkeleton';
import { useScheduleNames } from '@/hooks/useScheduleNames';

const messages = defineMessages({
  panelAriaLabel: {
    id: 'inspector.panelAriaLabel',
    defaultMessage: 'Class inspector panel',
  },
  classDetails: {
    id: 'inspector.classDetails',
    defaultMessage: 'Class Details',
  },
  closeInspector: {
    id: 'inspector.closeInspector',
    defaultMessage: 'Close inspector',
  },
});

const INSPECTOR_WIDTH = 380;

interface InspectorProps {
  // Omit for a read-only view (e.g. the published schedule) — suggestions
  // only make sense against a live, editable simulation session.
  readonly simId?: string;
}

export default function Inspector({ simId }: InspectorProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const inspectorOpen = useAppSelector((s) => s.ui.inspectorOpen);
  const selectedClassId = useAppSelector((s) => s.ui.selectedClassId);
  const classes = useAppSelector((s) => s.class.classes);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const { courseName } = useScheduleNames();

  const selectedClass = selectedClassId !== null
    ? classes.find((c) => c.id === selectedClassId)
    : undefined;

  const handleClose = (): void => {
    dispatch(deselectClass());
    dispatch(toggleInspector(false));
  };

  return (
    <Box
      aria-label={intl.formatMessage(messages.panelAriaLabel)}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: INSPECTOR_WIDTH,
        bgcolor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
        boxShadow: -6,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: inspectorOpen ? 'translateX(0)' : `translateX(${INSPECTOR_WIDTH}px)`,
        transition: 'transform 0.25s ease',
        zIndex: 10,
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {selectedClass !== undefined ? (
            <>
              <Typography variant="h4" component="h2" noWrap>
                {courseName(selectedClass.courseId)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {selectedClass.title}
              </Typography>
            </>
          ) : (
            <Typography variant="h4" component="h2">
              {intl.formatMessage(messages.classDetails)}
            </Typography>
          )}
        </Box>

        <Tooltip title={intl.formatMessage(messages.closeInspector)}>
          <IconButton
            onClick={handleClose}
            aria-label={intl.formatMessage(messages.closeInspector)}
            edge="end"
          >
            <Close />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content — scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {inspectorOpen && selectedClass === undefined && <InspectorSkeleton />}

        {selectedClass !== undefined && (
          <ClassDetailSection
            classItem={selectedClass}
            conflicts={conflicts}
            classes={classes}
            simId={simId}
          />
        )}
      </Box>
    </Box>
  );
}
