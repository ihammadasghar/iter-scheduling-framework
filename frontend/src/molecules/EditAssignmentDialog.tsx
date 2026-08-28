import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useAppSelector } from '@/store/hooks';
import { useApplySuggestion } from '@/hooks/useApplySuggestion';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import { DeltaChip, ScoreDeltaChip } from '@/molecules/SuggestionCard';
import AssignmentOverlayCalendar from '@/organisms/AssignmentOverlayCalendar';
import SuggestionsList from '@/organisms/SuggestionsList';
import { deriveDayOrder, computeContiguousSlotIds, timeToMinutes } from '@/utils/calendarLayout';
import { buildOverlayBlocks } from '@/utils/overlayLayout';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { ScheduleClass } from '@/types';

interface EditAssignmentDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly simId: string;
  readonly classId: string;
  readonly currentClass: ScheduleClass;
}

// Order-independent comparison — a class's own timeSlotIds aren't guaranteed
// to already be chronologically sorted.
const sameSlots = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

/**
 * Replaces ManualRescheduleForm ("Or Choose It Yourself") and
 * ChangeRoomDialog (Change Room): a single tool that overlays the room's,
 * professor's, and student group's weekly schedules together so the user
 * can see exactly where all three are free, then reassign any combination
 * of room/professor/student group/time at once. Slot selection stays
 * Day/Period dropdowns (DESIGN.md's non-technical-user, no-drag-and-drop
 * mandate) — the calendar is the visual aid, with a click-on-an-empty-cell
 * shortcut that fills the dropdowns in.
 */
export default function EditAssignmentDialog({
  open,
  onClose,
  simId,
  classId,
  currentClass,
}: EditAssignmentDialogProps): React.ReactElement {
  const classes = useAppSelector((s) => s.class.classes);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const professors = useAppSelector((s) => s.schedule.professors);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const timeSlots = useAppSelector((s) => s.schedule.timeSlots);
  const { roomName, professorName, groupName } = useScheduleNames();
  const { apply, loading, error, lastDelta, lastScoreDelta, deltaLoading } = useApplySuggestion(simId);

  const timeSlotById = useMemo(() => new Map(timeSlots.map((ts) => [ts.id, ts])), [timeSlots]);
  const dayOrder = useMemo(() => deriveDayOrder(timeSlots), [timeSlots]);
  const currentFirstSlot = timeSlotById.get(currentClass.timeSlotIds[0] ?? '');

  const [roomId, setRoomId] = useState(currentClass.roomId);
  const [professorId, setProfessorId] = useState(currentClass.professorId);
  const [studentGroupId, setStudentGroupId] = useState(currentClass.studentGroupId);
  const [day, setDay] = useState(currentFirstSlot?.day ?? dayOrder[0] ?? '');
  const [startSlotId, setStartSlotId] = useState(currentClass.timeSlotIds[0] ?? '');
  const [appliedSummary, setAppliedSummary] = useState<{ label: string; timeLabel: string } | null>(null);

  // The useState calls above only seed their initial value once, on this
  // component's first-ever mount — but Inspector/ClassDetailSection don't
  // key their children by classId, so the same EditAssignmentDialog
  // instance is reused across different class selections. Without this,
  // reopening "Edit" for a different class (or reopening the same class
  // after an abandoned edit) would keep showing whichever room/professor/
  // group/time was left over from before. Re-seed from the live
  // currentClass every time the dialog opens instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally
  // keyed on (open, classId), not the currentClass/timeSlotById/dayOrder
  // object references, which change on every unrelated Redux refresh and
  // would otherwise wipe out an in-progress edit while the dialog is open.
  useEffect(() => {
    if (!open) return;
    setRoomId(currentClass.roomId);
    setProfessorId(currentClass.professorId);
    setStudentGroupId(currentClass.studentGroupId);
    const firstSlot = timeSlotById.get(currentClass.timeSlotIds[0] ?? '');
    setDay(firstSlot?.day ?? dayOrder[0] ?? '');
    setStartSlotId(currentClass.timeSlotIds[0] ?? '');
    setAppliedSummary(null);
  }, [open, classId]);

  const duration = currentClass.timeSlotIds.length || 1;

  const periodsForDay = useMemo(
    () => timeSlots
      .filter((ts) => ts.day === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [timeSlots, day],
  );

  const targetSlotIds = startSlotId === ''
    ? null
    : computeContiguousSlotIds(periodsForDay, startSlotId, duration);

  // "Busy" sets for whichever room/professor/group is currently selected —
  // not necessarily the class's original ones — so trying a different
  // combination immediately shows that combination's own schedule. The
  // class being edited is excluded from all three so its own current slot
  // doesn't show up as a false clash against itself.
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

  // The class being edited, positioned at whichever slot is currently
  // selected — rendered as just another block (source 'editing') so it
  // reads as a highlighted event like any other on the calendar, and moves
  // there the instant the Day/Period selection (or a click on the
  // calendar) changes, rather than needing separate "current vs. new slot"
  // bookkeeping. Omitted entirely when the selection is invalid (no valid
  // contiguous run for this day) — nothing to highlight in that case.
  const editingAtCandidate = useMemo(
    () => (targetSlotIds !== null ? [{ ...currentClass, timeSlotIds: targetSlotIds }] : []),
    [currentClass, targetSlotIds],
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
    if (targetSlotIds.some((id) => roomBusySlotIds.has(id))) clashes.push('the room');
    if (targetSlotIds.some((id) => professorBusySlotIds.has(id))) clashes.push('the professor');
    if (targetSlotIds.some((id) => groupBusySlotIds.has(id))) clashes.push('the student group');
  }

  const isUnchanged = targetSlotIds !== null
    && roomId === currentClass.roomId
    && professorId === currentClass.professorId
    && studentGroupId === currentClass.studentGroupId
    && sameSlots(targetSlotIds, currentClass.timeSlotIds);

  const canApply = targetSlotIds !== null && !isUnchanged && !loading;

  const handleClose = (): void => {
    setAppliedSummary(null);
    onClose();
  };

  const handleDayChange = (e: SelectChangeEvent<string>): void => {
    const newDay = e.target.value;
    setDay(newDay);
    const firstOfDay = timeSlots
      .filter((ts) => ts.day === newDay)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
    setStartSlotId(firstOfDay?.id ?? '');
    setAppliedSummary(null);
  };

  const handleSlotClick = (clickedDay: string, slotId: string): void => {
    setDay(clickedDay);
    setStartSlotId(slotId);
    setAppliedSummary(null);
  };

  const handleApply = async (): Promise<void> => {
    if (targetSlotIds === null) return;
    setAppliedSummary(null);
    const succeeded = await apply(classId, { roomId, professorId, studentGroupId, timeSlotIds: targetSlotIds });
    if (!succeeded) return;
    setAppliedSummary({
      label: `${roomName(roomId)} · ${professorName(professorId)} · ${groupName(studentGroupId)}`,
      timeLabel: targetSlotIds.map(formatTimeSlotFull).join(', '),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Edit Assignment
        <IconButton onClick={handleClose} aria-label="Close edit assignment dialog" size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="edit-assignment-room-label">Room</InputLabel>
              <Select
                labelId="edit-assignment-room-label"
                label="Room"
                inputProps={{ 'aria-label': 'Room' }}
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value); setAppliedSummary(null); }}
                // Keeps the closed field showing just the room name — the
                // capacity/building subtitle below is only for browsing the
                // open list, not for the collapsed selection itself.
                renderValue={(value) => rooms.find((r) => r.id === value)?.name ?? ''}
              >
                {rooms.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                      <Typography variant="body2">{r.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {r.building} · Capacity {r.capacity}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {room !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {room.building} · Capacity {room.capacity}
                </Typography>
              )}
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel id="edit-assignment-professor-label">Professor</InputLabel>
              <Select
                labelId="edit-assignment-professor-label"
                label="Professor"
                inputProps={{ 'aria-label': 'Professor' }}
                value={professorId}
                onChange={(e) => { setProfessorId(e.target.value); setAppliedSummary(null); }}
              >
                {professors.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
              {professor !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {professor.department} · {professorBusy.length} classes taught
                </Typography>
              )}
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel id="edit-assignment-group-label">Student Group</InputLabel>
              <Select
                labelId="edit-assignment-group-label"
                label="Student Group"
                inputProps={{ 'aria-label': 'Student Group' }}
                value={studentGroupId}
                onChange={(e) => { setStudentGroupId(e.target.value); setAppliedSummary(null); }}
              >
                {studentGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                ))}
              </Select>
              {group !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {group.size} students · {groupBusy.length} classes attended
                </Typography>
              )}
            </FormControl>
          </Stack>

          <AssignmentOverlayCalendar
            blocks={overlayBlocks}
            classById={classById}
            timeSlots={timeSlots}
            onSlotClick={handleSlotClick}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="edit-assignment-day-label">Day</InputLabel>
              <Select
                labelId="edit-assignment-day-label"
                label="Day"
                inputProps={{ 'aria-label': 'Day' }}
                value={day}
                onChange={handleDayChange}
              >
                {dayOrder.map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth disabled={periodsForDay.length === 0}>
              <InputLabel id="edit-assignment-period-label">Period</InputLabel>
              <Select
                labelId="edit-assignment-period-label"
                label="Period"
                inputProps={{ 'aria-label': 'Period' }}
                value={startSlotId}
                onChange={(e) => { setStartSlotId(e.target.value); setAppliedSummary(null); }}
              >
                {periodsForDay.map((ts) => (
                  <MenuItem key={ts.id} value={ts.id}>{formatTimeSlotFull(ts.id)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {startSlotId !== '' && targetSlotIds === null && (
            <Alert severity="warning">
              This day doesn&apos;t have enough consecutive periods left for a class this length.
              Try a different day or starting period.
            </Alert>
          )}

          {capacityExceeded && room !== undefined && group !== undefined && (
            <Alert severity="warning">
              {group.name} has {group.size} students, more than {room.name}&apos;s capacity of {room.capacity}.
            </Alert>
          )}

          {targetSlotIds !== null && clashes.length > 0 && (
            <Alert severity="warning">
              This time clashes with an existing class for {clashes.join(', ')}.
            </Alert>
          )}

          <Divider />
          <SuggestionsList simId={simId} classId={classId} currentClass={currentClass} />

          {appliedSummary && (
            <Alert severity="success">
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Moved to {appliedSummary.label} · {appliedSummary.timeLabel}
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
          {deltaLoading && <CircularProgress size={16} aria-label="Computing metric impact…" />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void handleApply()}
          disabled={!canApply}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {loading ? 'Applying…' : 'Apply Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
