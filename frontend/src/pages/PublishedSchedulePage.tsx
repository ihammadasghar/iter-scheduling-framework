import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import AppShell from '@/templates/AppShell';
import BackButton from '@/atoms/BackButton';
import TimetableGrid from '@/organisms/TimetableGrid';
import BrowseSchedulePanel from '@/organisms/BrowseSchedulePanel';
import Inspector from '@/organisms/Inspector';
import ViewBySelector from '@/molecules/ViewBySelector';
import WorkspaceTabs, { type WorkspaceTabValue } from '@/molecules/WorkspaceTabs';
import WeekNavigator from '@/molecules/WeekNavigator';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPublishedClassesPage, resetClasses } from '@/store/reducers/classSlice';
import { fetchPublishedScheduleThunk } from '@/store/reducers/scheduleSlice';
import { initialWeekStart, excludedDaysForWeek } from '@/utils/weekNavigation';

// Only Full Schedule and Browse apply here — this page has no simulation
// session, so no conflicts/metrics for Overview, and no redundant "My
// Schedule" (the Dashboard already shows the signed-in person's own
// published-schedule calendar).
const PUBLISHED_TABS: readonly WorkspaceTabValue[] = ['grid', 'browse'];

const PAGE_SIZE = 50; // must match PAGE_SIZE in classSlice

// Read-only view of the currently published (main) schedule — no simulation
// session, no editing affordances (no HUD/conflicts/metrics/score/submit,
// no heartbeat/inactivity tracking). Just "what does the live timetable
// look like right now".
export default function PublishedSchedulePage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.class.error);
  const [tab, setTab] = useState<WorkspaceTabValue>('grid');

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
  const excludedDaySet = useMemo(() => new Set(excludedDays.keys()), [excludedDays]);

  useEffect(() => {
    dispatch(resetClasses());
    // Master data (room/professor/course/group names) for this page's chips
    // and Inspector — fire-and-forget, not awaited before class loading. A
    // failure here just means labels fall back to ID-derived strings, same
    // as before this roster existed; no error banner needed for it.
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

  return (
    <AppShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
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
          <BackButton />
          <Typography variant="h6" component="h1" sx={{ mr: 1 }}>
            Published Schedule
          </Typography>
          {tab === 'grid' && <ViewBySelector />}
          {metadata !== null && weekStart !== null && (
            <WeekNavigator weekStart={weekStart} onWeekChange={setWeekStart} timeline={metadata.timeline} />
          )}
          <Box sx={{ flex: 1 }} />
        </Box>

        {/* Tab bar */}
        <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <WorkspaceTabs value={tab} onChange={setTab} tabs={PUBLISHED_TABS} />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
            Could not load the published schedule. Please try again.
          </Alert>
        )}

        {/* Main area: grid + inspector overlay (read-only — no simId), or Browse */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          {tab === 'grid' ? (
            <>
              <TimetableGrid excludedDays={excludedDaySet} />
              <Inspector />
            </>
          ) : (
            <BrowseSchedulePanel excludedDays={excludedDays} />
          )}
        </Box>
      </Box>
    </AppShell>
  );
}
