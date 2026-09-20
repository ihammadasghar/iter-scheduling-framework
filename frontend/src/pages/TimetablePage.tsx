import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';
import MyScheduleCalendar from '@/organisms/MyScheduleCalendar';
import BrowseSchedulePanel from '@/organisms/BrowseSchedulePanel';
import SimulationOverview from '@/organisms/SimulationOverview';
import Inspector from '@/organisms/Inspector';
import HUD from '@/organisms/HUD';
import SessionExpiryModal from '@/organisms/SessionExpiryModal';
import ScheduleUpdatedModal from '@/organisms/ScheduleUpdatedModal';
import SubmitProposalModal from '@/organisms/SubmitProposalModal';
import SaveChangesButton from '@/molecules/SaveChangesButton';
import MetricsToolbar from '@/molecules/MetricsToolbar';
import InactivityBanner from '@/molecules/InactivityBanner';
import WorkspaceTabs, { type WorkspaceTabValue } from '@/molecules/WorkspaceTabs';
import WeekNavigator from '@/molecules/WeekNavigator';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSession, markExpired } from '@/store/reducers/sessionSlice';
import { loadSimulationsFromStorage } from '@/store/reducers/simulationSlice';
import { fetchClassesPage, resetClasses } from '@/store/reducers/classSlice';
import { fetchScheduleThunk } from '@/store/reducers/scheduleSlice';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useInactivityWarning } from '@/hooks/useInactivityWarning';
import { initialWeekStart, excludedDaysForWeek } from '@/utils/weekNavigation';
import type { ConflictType, UserRole } from '@/types';

const messages = defineMessages({
  noSimId: {
    id: 'timetablePage.noSimId',
    defaultMessage: 'No simulation ID provided.',
  },
});

const PAGE_SIZE = 1000; // must match PAGE_SIZE in classSlice

// A professor/student's default landing tab is their own calendar; anyone
// else (admin, or no identity chosen at all — e.g. in isolated tests) lands
// on Browse, the role-independent "look up anyone's schedule" view — "My
// Schedule" is meaningless without a professorId/studentGroupId to filter
// by, and the Full Schedule grid is no longer part of this workspace.
const defaultTabFor = (role: UserRole | undefined): WorkspaceTabValue =>
  role === 'professor' || role === 'student' ? 'myschedule' : 'browse';

export default function TimetablePage(): React.ReactElement {
  const intl = useIntl();
  const { id: simId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const identity = useAppSelector((s) => s.identity.identity);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [tab, setTab] = useState<WorkspaceTabValue>(() => defaultTabFor(identity?.role));

  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const conflictedClassIds = useMemo(
    () => new Set(conflicts.flatMap((c) => c.classIds)),
    [conflicts],
  );

  // Week navigation — shared across the My Schedule/Browse tabs so switching
  // tabs preserves the selected week. null until the roster's metadata (and
  // thus semester bounds) has loaded.
  const metadata = useAppSelector((s) => s.schedule.metadata);
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

  // Session lifecycle hooks
  useHeartbeat(simId ?? null);
  const { showWarning, dismiss } = useInactivityWarning(simId ?? '');

  // On mount: set session context and eagerly load all class pages + schedule master data.
  // A 404 here means the simulation's backend session is already gone (TTL expiry, server
  // restart, etc.) — surface that immediately via the same SessionExpiryModal useHeartbeat
  // drives, rather than leaving a blank grid until the next 60s heartbeat tick catches it.
  useEffect(() => {
    if (!simId) return;
    dispatch(resetClasses());
    dispatch(setSession(simId));
    // Only SimulationDashboardPage normally loads the persisted simulation
    // list — a user landing directly on this page (bookmark/refresh) would
    // otherwise have an empty state.simulation.simulations, and
    // SubmitProposalModal/ScheduleUpdatedModal need this simulation's
    // baseScheduleVersion to be in there.
    dispatch(loadSimulationsFromStorage());

    const loadSchedule = async (): Promise<void> => {
      const result = await dispatch(fetchScheduleThunk(simId));
      if (fetchScheduleThunk.rejected.match(result) && result.payload?.statusCode === 404) {
        dispatch(markExpired());
      }
    };

    const loadAll = async (): Promise<void> => {
      let page = 1;
      let more = true;
      while (more) {
        const result = await dispatch(fetchClassesPage({ simId, page }));
        if (fetchClassesPage.fulfilled.match(result)) {
          more = result.payload.classes.length === PAGE_SIZE;
          page++;
        } else {
          if (fetchClassesPage.rejected.match(result) && result.payload?.statusCode === 404) {
            dispatch(markExpired());
          }
          break;
        }
      }
    };

    // Wait for both the schedule metadata and every class page before
    // honoring an auto-edit deep link (e.g. from a fresh simulation created
    // via "Edit in a Simulation") — EditClassPage reads both state.class and
    // state.schedule straight from the store with no loading of its own.
    void Promise.all([loadSchedule(), loadAll()]).then(() => {
      const autoEditClassId = (location.state as { autoEditClassId?: string } | null)?.autoEditClassId;
      if (autoEditClassId !== undefined) {
        navigate(`/simulations/${simId}/classes/${autoEditClassId}/edit`, { replace: true });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId]);

  const handleSelectConflictType = (type: ConflictType): void => {
    const match = conflicts.find((c) => c.type === type);
    if (match !== undefined) {
      dispatch(selectClass(match.classIds[0]));
      dispatch(toggleInspector(true));
    }
    setTab('myschedule');
  };

  if (!simId) {
    return (
      <AppShell>
        <Box sx={{ p: 4 }}>
          <Typography color="error">{intl.formatMessage(messages.noSimId)}</Typography>
        </Box>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* Inactivity warning — pinned below TopAppBar */}
        {showWarning && (
          <InactivityBanner simId={simId} onDismiss={dismiss} />
        )}

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
          {/* Week-agnostic — the Overview tab summarizes conflicts/metrics across
              the whole simulation, not one week. */}
          {tab !== 'overview' && metadata !== null && weekStart !== null && (
            <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} timeline={metadata.timeline} />
          )}
          <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <MetricsToolbar />
          </Box>
          <SaveChangesButton simId={simId} />
        </Box>

        {/* Workspace tabs */}
        <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <WorkspaceTabs value={tab} onChange={setTab} />
        </Box>

        {/* Main area: calendar/browse + inspector overlay, or overview */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          {tab === 'myschedule' ? (
            <>
              <MyScheduleCalendar conflictedClassIds={conflictedClassIds} excludedDays={excludedDays} />
              <Inspector simId={simId} />
            </>
          ) : tab === 'browse' ? (
            <>
              <BrowseSchedulePanel conflictedClassIds={conflictedClassIds} excludedDays={excludedDays} />
              <Inspector simId={simId} />
            </>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <SimulationOverview
                onGoToGridView={() => setTab(defaultTabFor(identity?.role))}
                onSelectConflictType={handleSelectConflictType}
              />
            </Box>
          )}
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

      {/* Session expiry overlay — non-dismissable */}
      <SessionExpiryModal />
      <ScheduleUpdatedModal />
    </AppShell>
  );
}
