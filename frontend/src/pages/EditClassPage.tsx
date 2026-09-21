import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Divider, FormControl, InputLabel,
  MenuItem, Popover, Select, Stack, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { ArrowBack, Schedule } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';
import { useAppSelector } from '@/store/hooks';
import { useApplySuggestion } from '@/hooks/useApplySuggestion';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useInactivityWarning } from '@/hooks/useInactivityWarning';
import { DeltaChip, ScoreDeltaChip } from '@/molecules/SuggestionCard';
import EditableAssignmentField from '@/molecules/EditableAssignmentField';
import InactivityBanner from '@/molecules/InactivityBanner';
import AssignmentOverlayCalendar from '@/organisms/AssignmentOverlayCalendar';
import SuggestionsList from '@/organisms/SuggestionsList';
import SessionExpiryModal from '@/organisms/SessionExpiryModal';
import { deriveDayOrder, computeContiguousSlotIds, timeToMinutes } from '@/utils/calendarLayout';
import { buildOverlayBlocks } from '@/utils/overlayLayout';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { ScheduleClass, Suggestion } from '@/types';

const messages = defineMessages({
  backToSchedule: {
    id: 'editClassPage.backToSchedule',
    defaultMessage: 'Back to Schedule',
  },
  invalidUrl: {
    id: 'editClassPage.invalidUrl',
    defaultMessage: 'No proposal or class specified.',
  },
  classNotFound: {
    id: 'editClassPage.classNotFound',
    defaultMessage: "This class couldn't be found. It may have been removed.",
  },
  editAssignment: {
    id: 'editClassPage.editAssignment',
    defaultMessage: 'Edit Assignment',
  },
  room: {
    id: 'editClassPage.room',
    defaultMessage: 'Room',
  },
  roomSubtitle: {
    id: 'editClassPage.roomSubtitle',
    defaultMessage: '{building} · Capacity {capacity}',
  },
  professor: {
    id: 'editClassPage.professor',
    defaultMessage: 'Professor',
  },
  professorSubtitle: {
    id: 'editClassPage.professorSubtitle',
    defaultMessage: '{department} · {count, plural, one {# class taught} other {# classes taught}}',
  },
  studentGroup: {
    id: 'editClassPage.studentGroup',
    defaultMessage: 'Student Group',
  },
  studentGroupSubtitle: {
    id: 'editClassPage.studentGroupSubtitle',
    defaultMessage: '{size, plural, one {# student} other {# students}} · {count, plural, one {# class attended} other {# classes attended}}',
  },
  time: {
    id: 'editClassPage.time',
    defaultMessage: 'Time',
  },
  selectTimeslotManually: {
    id: 'editClassPage.selectTimeslotManually',
    defaultMessage: 'Select Timeslot Manually',
  },
  day: {
    id: 'editClassPage.day',
    defaultMessage: 'Day',
  },
  period: {
    id: 'editClassPage.period',
    defaultMessage: 'Period',
  },
  periodOptionsUpdatedAnnouncement: {
    id: 'editClassPage.periodOptionsUpdatedAnnouncement',
    defaultMessage: 'Period options updated for {day}.',
  },
  notEnoughPeriods: {
    id: 'editClassPage.notEnoughPeriods',
    defaultMessage: "This day doesn't have enough consecutive periods left for a class this length. Try a different day or starting period.",
  },
  capacityExceeded: {
    id: 'editClassPage.capacityExceeded',
    defaultMessage: "{group} has {size} students, more than {room}'s capacity of {capacity}.",
  },
  clashRoom: {
    id: 'editClassPage.clashRoom',
    defaultMessage: 'the room',
  },
  clashProfessor: {
    id: 'editClassPage.clashProfessor',
    defaultMessage: 'the professor',
  },
  clashGroup: {
    id: 'editClassPage.clashGroup',
    defaultMessage: 'the student group',
  },
  clashesWarning: {
    id: 'editClassPage.clashesWarning',
    defaultMessage: 'This time clashes with an existing class for {clashes}.',
  },
  movedTo: {
    id: 'editClassPage.movedTo',
    defaultMessage: 'Moved to {label} · {timeLabel}',
  },
  computingImpactAriaLabel: {
    id: 'editClassPage.computingImpactAriaLabel',
    defaultMessage: 'Computing metric impact…',
  },
  cancel: {
    id: 'editClassPage.cancel',
    defaultMessage: 'Cancel',
  },
  applying: {
    id: 'editClassPage.applying',
    defaultMessage: 'Adding…',
  },
  applyChanges: {
    id: 'editClassPage.applyChanges',
    defaultMessage: 'Add to Proposal',
  },
});

const sameSlots = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

const pulsePeriodHint = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`;

const PERIOD_REPOPULATE_HINT_DURATION_MS = 1200;

const EMPTY_CLASS: ScheduleClass = {
  id: '', courseId: '', title: '', professorId: '', studentGroupId: '', roomId: '', timeSlotIds: [],
};

/**
 * Full-page successor to the old EditAssignmentDialog modal — same overlay
 * calendar + suggestions + validation logic, just with room to breathe:
 * Room/Professor/Student Group render as static details with an Edit
 * popover each, and Day/Period stay hidden behind "Select Timeslot
 * Manually" unless the calendar's click-to-set shortcut isn't precise
 * enough.
 */
export default function EditClassPage(): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();
  const { id: simId, classId } = useParams<{ id: string; classId: string }>();

  const classes = useAppSelector((s) => s.class.classes);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const professors = useAppSelector((s) => s.schedule.professors);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const timeSlots = useAppSelector((s) => s.schedule.timeSlots);
  const { roomName, professorName, groupName, courseName } = useScheduleNames();
  const { apply, loading, error, lastDelta, lastScoreDelta, deltaLoading } = useApplySuggestion(simId ?? '');

  useHeartbeat(simId ?? null);
  const { showWarning, dismiss } = useInactivityWarning(simId ?? '');

  const currentClass = classes.find((c) => c.id === classId);
  const cls = currentClass ?? EMPTY_CLASS;

  const timeSlotById = useMemo(() => new Map(timeSlots.map((ts) => [ts.id, ts])), [timeSlots]);
  const dayOrder = useMemo(() => deriveDayOrder(timeSlots), [timeSlots]);
  const currentFirstSlot = timeSlotById.get(cls.timeSlotIds[0] ?? '');

  const [roomId, setRoomId] = useState(cls.roomId);
  const [professorId, setProfessorId] = useState(cls.professorId);
  const [studentGroupId, setStudentGroupId] = useState(cls.studentGroupId);
  const [day, setDay] = useState(currentFirstSlot?.day ?? dayOrder[0] ?? '');
  const [startSlotId, setStartSlotId] = useState(cls.timeSlotIds[0] ?? '');
  const [appliedSummary, setAppliedSummary] = useState<{ label: string; timeLabel: string } | null>(null);
  const [timeslotAnchorEl, setTimeslotAnchorEl] = useState<HTMLElement | null>(null);

  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (navigateTimerRef.current !== null) clearTimeout(navigateTimerRef.current);
  }, []);

  const [periodHintActive, setPeriodHintActive] = useState(false);
  const periodHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPeriodHintTimer = (): void => {
    if (periodHintTimerRef.current !== null) {
      clearTimeout(periodHintTimerRef.current);
      periodHintTimerRef.current = null;
    }
  };
  useEffect(() => clearPeriodHintTimer, []);

  // Re-seeds from the live class whenever the URL's classId changes (e.g.
  // browser back/forward between two edit pages without a full remount).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
  // keyed on classId only, not currentClass/timeSlotById/dayOrder object
  // references, which change on every unrelated Redux refresh.
  useEffect(() => {
    if (currentClass === undefined) return;
    setRoomId(currentClass.roomId);
    setProfessorId(currentClass.professorId);
    setStudentGroupId(currentClass.studentGroupId);
    const firstSlot = timeSlotById.get(currentClass.timeSlotIds[0] ?? '');
    setDay(firstSlot?.day ?? dayOrder[0] ?? '');
    setStartSlotId(currentClass.timeSlotIds[0] ?? '');
    setAppliedSummary(null);
    clearPeriodHintTimer();
    setPeriodHintActive(false);
  }, [classId]);

  const duration = cls.timeSlotIds.length || 1;

  const periodsForDay = useMemo(
    () => timeSlots
      .filter((ts) => ts.day === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [timeSlots, day],
  );

  const targetSlotIds = startSlotId === ''
    ? null
    : computeContiguousSlotIds(periodsForDay, startSlotId, duration);

  const roomBusy = useMemo(
    () => classes.filter((c) => c.roomId === roomId && c.id !== classId),
    [classes, roomId, classId],
  );
  const professorBusy = useMemo(
    () => classes.filter((c) => c.professorId === professorId && c.id !== classId),
    [classes, professorId, classId],
  );
  const groupBusy = useMemo(
    () => classes.filter((c) => c.studentGroupId === studentGroupId && c.id !== classId),
    [classes, studentGroupId, classId],
  );
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const editingAtCandidate = useMemo(
    () => (targetSlotIds !== null ? [{ ...cls, timeSlotIds: targetSlotIds }] : []),
    [cls, targetSlotIds],
  );
  const overlayBlocks = useMemo(
    () => buildOverlayBlocks(
      [
        { source: 'room', classes: roomBusy },
        { source: 'professor', classes: professorBusy },
        { source: 'group', classes: groupBusy },
        { source: 'editing', classes: editingAtCandidate },
      ],
      timeSlotById,
    ),
    [roomBusy, professorBusy, groupBusy, editingAtCandidate, timeSlotById],
  );

  const room = rooms.find((r) => r.id === roomId);
  const professor = professors.find((p) => p.id === professorId);
  const group = studentGroups.find((g) => g.id === studentGroupId);
  const capacityExceeded = room !== undefined && group !== undefined && group.size > room.capacity;

  const busySlotIds = (source: readonly ScheduleClass[]): Set<string> =>
    new Set(source.flatMap((c) => c.timeSlotIds));
  const roomBusySlotIds = useMemo(() => busySlotIds(roomBusy), [roomBusy]);
  const professorBusySlotIds = useMemo(() => busySlotIds(professorBusy), [professorBusy]);
  const groupBusySlotIds = useMemo(() => busySlotIds(groupBusy), [groupBusy]);

  const clashes: string[] = [];
  if (targetSlotIds !== null) {
    if (targetSlotIds.some((id) => roomBusySlotIds.has(id))) clashes.push(intl.formatMessage(messages.clashRoom));
    if (targetSlotIds.some((id) => professorBusySlotIds.has(id))) clashes.push(intl.formatMessage(messages.clashProfessor));
    if (targetSlotIds.some((id) => groupBusySlotIds.has(id))) clashes.push(intl.formatMessage(messages.clashGroup));
  }

  const isUnchanged = targetSlotIds !== null
    && roomId === cls.roomId
    && professorId === cls.professorId
    && studentGroupId === cls.studentGroupId
    && sameSlots(targetSlotIds, cls.timeSlotIds);

  const canApply = targetSlotIds !== null && !isUnchanged && !loading;

  const handleDayChange = (e: SelectChangeEvent<string>): void => {
    const newDay = e.target.value;
    setDay(newDay);
    const firstOfDay = timeSlots
      .filter((ts) => ts.day === newDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
    setStartSlotId(firstOfDay?.id ?? '');
    setAppliedSummary(null);

    clearPeriodHintTimer();
    setPeriodHintActive(true);
    periodHintTimerRef.current = setTimeout(() => {
      periodHintTimerRef.current = null;
      setPeriodHintActive(false);
    }, PERIOD_REPOPULATE_HINT_DURATION_MS);
  };

  const handleSlotClick = (clickedDay: string, slotId: string): void => {
    setDay(clickedDay);
    setStartSlotId(slotId);
    setAppliedSummary(null);
  };

  const handleStageSuggestion = (suggestion: Suggestion): void => {
    setRoomId(suggestion.roomId);
    const firstSlot = timeSlotById.get(suggestion.timeSlotIds[0] ?? '');
    if (firstSlot === undefined) return;
    setDay(firstSlot.day);
    setStartSlotId(suggestion.timeSlotIds[0]);
    setAppliedSummary(null);
  };

  const handleApply = async (): Promise<void> => {
    if (targetSlotIds === null || simId === undefined || classId === undefined) return;
    setAppliedSummary(null);
    const succeeded = await apply(classId, { roomId, professorId, studentGroupId, timeSlotIds: targetSlotIds });
    if (!succeeded) return;
    setAppliedSummary({
      label: `${roomName(roomId)} · ${professorName(professorId)} · ${groupName(studentGroupId)}`,
      timeLabel: targetSlotIds.map(formatTimeSlotFull).join(', '),
    });
    navigateTimerRef.current = setTimeout(() => {
      navigateTimerRef.current = null;
      navigate(`/simulations/${simId}`);
    }, 1200);
  };

  if (simId === undefined || classId === undefined) {
    return (
      <AppShell>
        <Box sx={{ p: 4 }}>
          <Typography color="error">{intl.formatMessage(messages.invalidUrl)}</Typography>
        </Box>
      </AppShell>
    );
  }

  if (currentClass === undefined) {
    return (
      <AppShell>
        <Box sx={{ p: 4 }}>
          <Typography color="error" sx={{ mb: 2 }}>{intl.formatMessage(messages.classNotFound)}</Typography>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(`/simulations/${simId}`)}>
            {intl.formatMessage(messages.backToSchedule)}
          </Button>
        </Box>
      </AppShell>
    );
  }

  const timeLabel = targetSlotIds !== null
    ? targetSlotIds.map(formatTimeSlotFull).join(', ')
    : (startSlotId !== '' ? formatTimeSlotFull(startSlotId) : '—');

  return (
    <AppShell>
      <Box sx={{ maxWidth: 1400, mx: 'auto', px: 3, py: 3, pb: 12 }}>
        {showWarning && <InactivityBanner simId={simId} onDismiss={dismiss} />}

        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/simulations/${simId}`)} sx={{ mb: 1 }}>
          {intl.formatMessage(messages.backToSchedule)}
        </Button>

        <Typography variant="h3" component="h1">{courseName(currentClass.courseId)}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>{currentClass.title}</Typography>

        <Stack spacing={3}>
          <Stack spacing={0} divider={<Divider />}>
            <EditableAssignmentField
              label={intl.formatMessage(messages.room)}
              valueText={roomName(roomId)}
              subtitle={room !== undefined ? intl.formatMessage(messages.roomSubtitle, { building: room.building, capacity: room.capacity }) : undefined}
              options={rooms.map((r) => ({
                id: r.id,
                label: r.name,
                subtitle: intl.formatMessage(messages.roomSubtitle, { building: r.building, capacity: r.capacity }),
              }))}
              selectedId={roomId}
              onChange={(id) => { setRoomId(id); setAppliedSummary(null); }}
            />
            <EditableAssignmentField
              label={intl.formatMessage(messages.professor)}
              valueText={professorName(professorId)}
              subtitle={professor !== undefined ? intl.formatMessage(messages.professorSubtitle, { department: professor.department, count: professorBusy.length }) : undefined}
              options={professors.map((p) => ({ id: p.id, label: p.name }))}
              selectedId={professorId}
              onChange={(id) => { setProfessorId(id); setAppliedSummary(null); }}
            />
            <EditableAssignmentField
              label={intl.formatMessage(messages.studentGroup)}
              valueText={groupName(studentGroupId)}
              subtitle={group !== undefined ? intl.formatMessage(messages.studentGroupSubtitle, { size: group.size, count: groupBusy.length }) : undefined}
              options={studentGroups.map((g) => ({ id: g.id, label: g.name }))}
              selectedId={studentGroupId}
              onChange={(id) => { setStudentGroupId(id); setAppliedSummary(null); }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, flexShrink: 0, fontSize: 14 }}>
                {intl.formatMessage(messages.time)}
              </Typography>
              <Typography variant="body1" sx={{ fontSize: 16, flex: 1 }}>{timeLabel}</Typography>
              <Button
                size="small"
                startIcon={<Schedule fontSize="small" />}
                onClick={(e) => setTimeslotAnchorEl(e.currentTarget)}
              >
                {intl.formatMessage(messages.selectTimeslotManually)}
              </Button>
              <Popover
                open={timeslotAnchorEl !== null}
                anchorEl={timeslotAnchorEl}
                onClose={() => setTimeslotAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Stack spacing={2} sx={{ p: 2, minWidth: 260 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="edit-class-day-label">{intl.formatMessage(messages.day)}</InputLabel>
                    <Select
                      labelId="edit-class-day-label"
                      label={intl.formatMessage(messages.day)}
                      inputProps={{ 'aria-label': intl.formatMessage(messages.day) }}
                      value={day}
                      onChange={handleDayChange}
                    >
                      {dayOrder.map((d) => (
                        <MenuItem key={d} value={d}>{d}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl
                    size="small"
                    fullWidth
                    disabled={periodsForDay.length === 0}
                    sx={{
                      border: periodHintActive ? 2 : 0,
                      borderColor: periodHintActive ? 'info.main' : 'transparent',
                      borderRadius: 1,
                      transition: 'border-color 0.15s',
                      animation: periodHintActive ? `${pulsePeriodHint} 0.5s ease-in-out 2` : undefined,
                    }}
                  >
                    <InputLabel id="edit-class-period-label">{intl.formatMessage(messages.period)}</InputLabel>
                    <Select
                      labelId="edit-class-period-label"
                      label={intl.formatMessage(messages.period)}
                      inputProps={{ 'aria-label': intl.formatMessage(messages.period) }}
                      value={startSlotId}
                      onChange={(e) => { setStartSlotId(e.target.value); setAppliedSummary(null); }}
                    >
                      {periodsForDay.map((ts) => (
                        <MenuItem key={ts.id} value={ts.id}>{formatTimeSlotFull(ts.id)}</MenuItem>
                      ))}
                    </Select>
                    <Box
                      aria-live="polite"
                      sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
                    >
                      {periodHintActive ? intl.formatMessage(messages.periodOptionsUpdatedAnnouncement, { day }) : ''}
                    </Box>
                  </FormControl>
                </Stack>
              </Popover>
            </Box>
          </Stack>

          {startSlotId !== '' && targetSlotIds === null && (
            <Alert severity="warning">{intl.formatMessage(messages.notEnoughPeriods)}</Alert>
          )}
          {capacityExceeded && room !== undefined && group !== undefined && (
            <Alert severity="warning">
              {intl.formatMessage(messages.capacityExceeded, { group: group.name, size: group.size, room: room.name, capacity: room.capacity })}
            </Alert>
          )}
          {targetSlotIds !== null && clashes.length > 0 && (
            <Alert severity="warning">
              {intl.formatMessage(messages.clashesWarning, { clashes: clashes.join(', ') })}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <AssignmentOverlayCalendar
                blocks={overlayBlocks}
                classById={classById}
                timeSlots={timeSlots}
                onSlotClick={handleSlotClick}
                maxHeight={640}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
              <SuggestionsList
                simId={simId}
                classId={classId}
                currentClass={currentClass}
                onStageSuggestion={handleStageSuggestion}
              />
            </Box>
          </Stack>

          {appliedSummary && (
            <Alert severity="success">
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  {intl.formatMessage(messages.movedTo, { label: appliedSummary.label, timeLabel: appliedSummary.timeLabel })}
                </Typography>
                {(lastDelta !== null || lastScoreDelta !== null) && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {lastDelta !== null && <DeltaChip delta={lastDelta} />}
                    {lastScoreDelta !== null && <ScoreDeltaChip delta={lastScoreDelta} />}
                  </Box>
                )}
              </Stack>
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {deltaLoading && <CircularProgress size={16} aria-label={intl.formatMessage(messages.computingImpactAriaLabel)} />}
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'sticky', bottom: 0, bgcolor: 'background.paper', borderTop: '1px solid',
          borderColor: 'divider', px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', gap: 2,
        }}
      >
        <Button onClick={() => navigate(`/simulations/${simId}`)}>{intl.formatMessage(messages.cancel)}</Button>
        <Button
          variant="contained"
          onClick={() => void handleApply()}
          disabled={!canApply}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {loading ? intl.formatMessage(messages.applying) : intl.formatMessage(messages.applyChanges)}
        </Button>
      </Box>

      <SessionExpiryModal />
    </AppShell>
  );
}
