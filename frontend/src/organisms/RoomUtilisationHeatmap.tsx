import { useMemo, useState } from 'react';
import {
  Box, Link, Tooltip, Typography,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { formatRoomLabel, formatTimeSlotLabel } from '@/utils/scheduleFormatters';
import type { OccupancyCell, OccupancyLookup } from '@/utils/aggregateOccupancy';
import type { RawRoom, ScheduleClass } from '@/types';

interface RoomUtilisationHeatmapProps {
  readonly occupancy: OccupancyLookup;
  readonly rooms: readonly RawRoom[];
  readonly sortedTimeSlotIds: readonly string[];
  readonly classes: readonly ScheduleClass[];
}

// Validated sequential teal ramp (see docs/superpowers/specs/2026-07-24-simulation-overview-visualizations-design.md)
const RAMP = ['#6fae9f', '#4c9385', '#2c7d6c', '#046b5e', '#023b33'] as const;
const UNBOOKED_COLOR = '#e7e8f0'; // theme.palette.surfaceContainerHigh — neutral, not part of the ramp

const seatFillToColor = (ratio: number): string => {
  if (ratio < 0.2) return RAMP[0];
  if (ratio < 0.4) return RAMP[1];
  if (ratio < 0.6) return RAMP[2];
  if (ratio < 0.8) return RAMP[3];
  return RAMP[4];
};

export default function RoomUtilisationHeatmap({
  occupancy,
  rooms,
  sortedTimeSlotIds,
  classes,
}: RoomUtilisationHeatmapProps): React.ReactElement {
  const [tableView, setTableView] = useState(false);

  const classTitleById = useMemo(
    () => new Map(classes.map((cls) => [cls.id, cls.title])),
    [classes],
  );

  const resolveClassTitles = (cell: OccupancyCell | undefined): string => {
    if (cell === undefined) return '';
    return cell.classIds.map((id) => classTitleById.get(id) ?? id).join(', ');
  };

  if (rooms.length === 0 || sortedTimeSlotIds.length === 0) {
    return <Typography color="text.secondary">No room data available for this draft.</Typography>;
  }

  const sortedRooms = [...rooms].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        Room Utilisation
      </Typography>

      {tableView ? (
        <Table size="small" aria-label="Room utilisation table">
          <TableHead>
            <TableRow>
              <TableCell>Room</TableCell>
              {sortedTimeSlotIds.map((tsId) => (
                <TableCell key={tsId}>{formatTimeSlotLabel(tsId)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{formatRoomLabel(room.id)}</TableCell>
                {sortedTimeSlotIds.map((tsId) => {
                  const cell = occupancy.get(room.id)?.get(tsId);
                  return (
                    <TableCell key={tsId}>
                      {cell === undefined
                        ? '—'
                        : `${Math.round(cell.seatFillRatio * 100)}% — ${resolveClassTitles(cell)}${cell.hasConflict ? ' (conflict)' : ''}`}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Box
          role="grid"
          aria-label="Room utilisation heatmap"
          sx={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${sortedTimeSlotIds.length}, minmax(60px, 1fr))`,
            gap: '2px',
          }}
        >
          <Box role="row" sx={{ display: 'contents' }}>
            <Box />
            {sortedTimeSlotIds.map((tsId) => (
              <Typography
                key={tsId}
                role="columnheader"
                variant="caption"
                align="center"
                sx={{ fontWeight: 600 }}
              >
                {formatTimeSlotLabel(tsId)}
              </Typography>
            ))}
          </Box>

          {sortedRooms.map((room) => (
            <Box key={room.id} role="row" sx={{ display: 'contents' }}>
              <Typography
                role="rowheader"
                variant="caption"
                sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}
              >
                {formatRoomLabel(room.id)}
              </Typography>
              {sortedTimeSlotIds.map((tsId) => {
                const cell = occupancy.get(room.id)?.get(tsId);
                const bg = cell === undefined ? UNBOOKED_COLOR : seatFillToColor(cell.seatFillRatio);
                const pct = cell === undefined ? null : Math.round(cell.seatFillRatio * 100);
                const label = pct === null
                  ? `${formatRoomLabel(room.id)} unbooked at ${formatTimeSlotLabel(tsId)}`
                  : `${formatRoomLabel(room.id)} ${pct}% full at ${formatTimeSlotLabel(tsId)}`;
                const tooltipTitle = pct === null
                  ? 'Unbooked'
                  : `${pct}% full — ${resolveClassTitles(cell)}${cell?.hasConflict === true ? ' — conflict' : ''}`;

                return (
                  <Tooltip
                    key={`${room.id}-${tsId}`}
                    title={tooltipTitle}
                    enterDelay={300}
                  >
                    <Box
                      role="gridcell"
                      sx={{ bgcolor: bg, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label={label}
                    >
                      {cell?.hasConflict === true && (
                        <WarningAmber fontSize="small" sx={{ color: 'warning.main' }} />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography variant="caption">Emptier</Typography>
        {RAMP.map((color) => (
          <Box key={color} sx={{ width: 16, height: 16, bgcolor: color }} aria-hidden />
        ))}
        <Typography variant="caption">Fuller</Typography>
        <Link
          component="button"
          variant="caption"
          onClick={() => setTableView((v) => !v)}
          sx={{ ml: 2 }}
        >
          {tableView ? 'View as heatmap' : 'View as table'}
        </Link>
      </Box>
    </Box>
  );
}
