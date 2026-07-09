import { Box, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deselectClass, toggleInspector } from '@/store/reducers/uiSlice';
import ClassDetailSection from '@/molecules/ClassDetailSection';
import SuggestionsList from '@/organisms/SuggestionsList';
import InspectorSkeleton from '@/organisms/InspectorSkeleton';
import { formatCourseLabel } from '@/utils/scheduleFormatters';

const INSPECTOR_WIDTH = 380;

interface InspectorProps {
  readonly simId: string;
}

export default function Inspector({ simId }: InspectorProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const inspectorOpen = useAppSelector((s) => s.ui.inspectorOpen);
  const selectedClassId = useAppSelector((s) => s.ui.selectedClassId);
  const classes = useAppSelector((s) => s.class.classes);

  const selectedClass = selectedClassId !== null
    ? classes.find((c) => c.id === selectedClassId)
    : undefined;

  const handleClose = (): void => {
    dispatch(deselectClass());
    dispatch(toggleInspector(false));
  };

  return (
    <Box
      aria-label="Class inspector panel"
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
                {formatCourseLabel(selectedClass.courseId)}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {selectedClass.title}
              </Typography>
            </>
          ) : (
            <Typography variant="h4" component="h2">
              Class Details
            </Typography>
          )}
        </Box>

        <Tooltip title="Close inspector">
          <IconButton
            onClick={handleClose}
            aria-label="Close inspector"
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
          <>
            <ClassDetailSection classItem={selectedClass} />
            <Divider sx={{ my: 1 }} />
            <SuggestionsList simId={simId} classId={selectedClass.id} />
          </>
        )}
      </Box>
    </Box>
  );
}
