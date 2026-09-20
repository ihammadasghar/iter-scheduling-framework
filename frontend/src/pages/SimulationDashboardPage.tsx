import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { EditOutlined } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';
import MyScheduleCalendar from '@/organisms/MyScheduleCalendar';
import ClassDetailModal from '@/organisms/ClassDetailModal';
import CreateSimulationDialog from '@/molecules/CreateSimulationDialog';
import WeekNavigator from '@/molecules/WeekNavigator';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPublishedClassesPage, resetClasses } from '@/store/reducers/classSlice';
import { fetchPublishedScheduleThunk } from '@/store/reducers/scheduleSlice';
import { deselectClass } from '@/store/reducers/uiSlice';
import { initialWeekStart, excludedDaysForWeek } from '@/utils/weekNavigation';

const messages = defineMessages({
  dashboard: {
    id: 'simulationDashboardPage.dashboard',
    defaultMessage: 'Dashboard',
  },
  requestChanges: {
    id: 'simulationDashboardPage.requestChanges',
    defaultMessage: 'Simulate a Change',
  },
  yourWeeklySchedule: {
    id: 'simulationDashboardPage.yourWeeklySchedule',
    defaultMessage: 'Your Weekly Schedule',
  },
  scheduleLoadError: {
    id: 'simulationDashboardPage.scheduleLoadError',
    defaultMessage: 'Could not load your schedule. Please try again.',
  },
});

const PAGE_SIZE = 1000; // must match PAGE_SIZE in classSlice

export default function SimulationDashboardPage(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const classError = useAppSelector((state) => state.class.error);
  const classes = useAppSelector((state) => state.class.classes);
  const selectedClassId = useAppSelector((state) => state.ui.selectedClassId);
  const inspectorOpen = useAppSelector((state) => state.ui.inspectorOpen);
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // 'new' — the header's "Simulate a Change" button; a classId — the class
  // detail modal's "Edit in a Simulation" button; null — closed. One value
  // so the shared CreateSimulationDialog instance below has a single source
  // of truth for both entry points instead of two independent booleans.
  const [simDialogTarget, setSimDialogTarget] = useState<'new' | string | null>(null);

  // Independent week-nav state — this page has no sibling tabs to stay in
  // sync with (unlike TimetablePage/PublishedSchedulePage's shared tab set).
  const metadata = useAppSelector((state) => state.schedule.metadata);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  useEffect(() => {
    if (metadata !== null && weekStart === null) {
      setWeekStart(initialWeekStart(metadata.timeline));
    }
  }, [metadata, weekStart]);
  const excludedDays = useMemo(
    () => (metadata && weekStart ? excludedDaysForWeek(weekStart, metadata.timeline) : new Map<string, string>()),
    [metadata, weekStart],
  );

  // Load the published schedule (roster + classes) so "Your Weekly Schedule"
  // below has something to filter — there's no simulation yet at this point
  // in the flow, so "their own schedule" means the live, published one.
  useEffect(() => {
    dispatch(resetClasses());
    void dispatch(fetchPublishedScheduleThunk());

    const loadAll = async (): Promise<void> => {
      let page = 1;
      let more = true;
      while (more) {
        const result = await dispatch(fetchPublishedClassesPage({ page }));
        if (fetchPublishedClassesPage.fulfilled.match(result)) {
          more = result.payload.classes.length === PAGE_SIZE;
          page++;
        } else {
          break;
        }
      }
    };

    void loadAll();
  }, [dispatch]);

  const handleRequestChanges = (): void => {
    setSimDialogTarget('new');
  };

  return (
    <AppShell>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h1" component="h1">
            {intl.formatMessage(messages.dashboard)}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<EditOutlined />}
            onClick={handleRequestChanges}
          >
            {intl.formatMessage(messages.requestChanges)}
          </Button>
        </Box>

        {/* The signed-in professor/student's own weekly schedule, straight
            from the published timetable — "see your schedule" is step one
            of the see → request → simulate → propose flow. */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="overline" color="text.secondary" component="h2">
            {intl.formatMessage(messages.yourWeeklySchedule)}
          </Typography>
          {metadata !== null && weekStart !== null && (
            <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} timeline={metadata.timeline} />
          )}
        </Box>
        {classError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {intl.formatMessage(messages.scheduleLoadError)}
          </Alert>
        )}
        <Box
          sx={{
            height: 480,
            display: 'flex',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            mb: 4,
          }}
        >
          <MyScheduleCalendar excludedDays={excludedDays} />
        </Box>
      </Container>

      <ClassDetailModal
        open={inspectorOpen}
        classItem={selectedClass}
        onClose={() => dispatch(deselectClass())}
        onEditInSimulation={() => {
          if (selectedClass === undefined) return;
          dispatch(deselectClass());
          setSimDialogTarget(selectedClass.id);
        }}
      />

      <CreateSimulationDialog
        open={simDialogTarget !== null}
        targetClassId={typeof simDialogTarget === 'string' ? simDialogTarget : undefined}
        onClose={() => setSimDialogTarget(null)}
      />
    </AppShell>
  );
}
