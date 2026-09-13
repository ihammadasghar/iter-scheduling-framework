import { useMemo, useState } from 'react';
import {
  Box, Link, Tooltip, Typography,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { formatTimeSlotLabel } from '@/utils/scheduleFormatters';
import type { OccupancyCell, OccupancyLookup } from '@/utils/aggregateOccupancy';
import type { RawRoom, ScheduleClass } from '@/types';

const messages = defineMessages({
  noRoomData: {
    id: 'roomUtilisationHeatmap.noRoomData',
    defaultMessage: 'No room data available for this draft.',
  },
  title: {
    id: 'roomUtilisationHeatmap.title',
    defaultMessage: 'Room Utilisation',
  },
  tableAriaLabel: {
    id: 'roomUtilisationHeatmap.tableAriaLabel',
    defaultMessage: 'Room utilisation table',
  },
  room: {
    id: 'roomUtilisationHeatmap.room',
    defaultMessage: 'Room',
  },
  emptyCell: {
    id: 'roomUtilisationHeatmap.emptyCell',
    defaultMessage: '—',
  },
  tableCellSummary: {
    id: 'roomUtilisationHeatmap.tableCellSummary',
    defaultMessage: '{pct}% — {titles}{conflict}',
  },
  conflictSuffix: {
    id: 'roomUtilisationHeatmap.conflictSuffix',
    defaultMessage: ' (conflict)',
  },
  conflictSuffixDash: {
    id: 'roomUtilisationHeatmap.conflictSuffixDash',
    defaultMessage: ' — conflict',
  },
  heatmapAriaLabel: {
    id: 'roomUtilisationHeatmap.heatmapAriaLabel',
    defaultMessage: 'Room utilisation heatmap',
  },
  unbookedAriaLabel: {
    id: 'roomUtilisationHeatmap.unbookedAriaLabel',
    defaultMessage: '{room} unbooked at {timeSlot}',
  },
  bookedAriaLabel: {
    id: 'roomUtilisationHeatmap.bookedAriaLabel',
    defaultMessage: '{room} {pct}% full at {timeSlot}',
  },
  unbookedTooltip: {
    id: 'roomUtilisationHeatmap.unbookedTooltip',
    defaultMessage: 'Unbooked',
  },
  bookedTooltip: {
    id: 'roomUtilisationHeatmap.bookedTooltip',
    defaultMessage: '{pct}% full — {titles}{conflict}',
  },
  emptier: {
    id: 'roomUtilisationHeatmap.emptier',
    defaultMessage: 'Emptier',
  },
  fuller: {
    id: 'roomUtilisationHeatmap.fuller',
    defaultMessage: 'Fuller',
  },
  viewAsHeatmap: {
    id: 'roomUtilisationHeatmap.viewAsHeatmap',
    defaultMessage: 'View as heatmap',
  },
  viewAsTable: {
    id: 'roomUtilisationHeatmap.viewAsTable',
    defaultMessage: 'View as table',
  },
});

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
  const intl = useIntl();
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
    return <Typography color="text.secondary">{intl.formatMessage(messages.noRoomData)}</Typography>;
  }

  const sortedRooms = [...rooms].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        {intl.formatMessage(messages.title)}
      </Typography>

      {tableView ? (
        <Table size="small" aria-label={intl.formatMessage(messages.tableAriaLabel)}>
          <TableHead>
            <TableRow>
              <TableCell>{intl.formatMessage(messages.room)}</TableCell>
              {sortedTimeSlotIds.map((tsId) => (
                <TableCell key={tsId}>{formatTimeSlotLabel(tsId)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{room.name}</TableCell>
                {sortedTimeSlotIds.map((tsId) => {
                  const cell = occupancy.get(room.id)?.get(tsId);
                  return (
                    <TableCell key={tsId}>
                      {cell === undefined
                        ? intl.formatMessage(messages.emptyCell)
                        : intl.formatMessage(messages.tableCellSummary, {
                          pct: Math.round(cell.seatFillRatio * 100),
                          titles: resolveClassTitles(cell),
                          conflict: cell.hasConflict ? intl.formatMessage(messages.conflictSuffix) : '',
                        })}
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
          aria-label={intl.formatMessage(messages.heatmapAriaLabel)}
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
                {room.name}
              </Typography>
              {sortedTimeSlotIds.map((tsId) => {
                const cell = occupancy.get(room.id)?.get(tsId);
                const bg = cell === undefined ? UNBOOKED_COLOR : seatFillToColor(cell.seatFillRatio);
                const pct = cell === undefined ? null : Math.round(cell.seatFillRatio * 100);
                const timeSlot = formatTimeSlotLabel(tsId);
                const label = pct === null
                  ? intl.formatMessage(messages.unbookedAriaLabel, { room: room.name, timeSlot })
                  : intl.formatMessage(messages.bookedAriaLabel, { room: room.name, pct, timeSlot });
                const tooltipTitle = pct === null
                  ? intl.formatMessage(messages.unbookedTooltip)
                  : intl.formatMessage(messages.bookedTooltip, {
                    pct,
                    titles: resolveClassTitles(cell),
                    conflict: cell?.hasConflict === true ? intl.formatMessage(messages.conflictSuffixDash) : '',
                  });

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
        <Typography variant="caption">{intl.formatMessage(messages.emptier)}</Typography>
        {RAMP.map((color) => (
          <Box key={color} sx={{ width: 16, height: 16, bgcolor: color }} aria-hidden />
        ))}
        <Typography variant="caption">{intl.formatMessage(messages.fuller)}</Typography>
        <Link
          component="button"
          variant="caption"
          onClick={() => setTableView((v) => !v)}
          sx={{ ml: 2 }}
        >
          {tableView ? intl.formatMessage(messages.viewAsHeatmap) : intl.formatMessage(messages.viewAsTable)}
        </Link>
      </Box>
    </Box>
  );
}
