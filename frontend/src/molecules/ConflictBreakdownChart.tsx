import { BarChart } from '@mui/x-charts/BarChart';
import { Typography } from '@mui/material';
import type { ConflictTypeCount } from '@/utils/groupConflictsByType';
import type { ConflictType } from '@/types';

interface ConflictBreakdownChartProps {
  readonly counts: readonly ConflictTypeCount[];
  readonly onBarClick?: (type: ConflictType) => void;
}

// Validated categorical palette (see docs/superpowers/specs/2026-07-24-simulation-overview-visualizations-design.md).
// ROOM_CAPACITY_EXCEEDED's rose slot was added after that spec landed — re-validated
// via the dataviz skill's validate_palette.js (adjacent-pairs, light mode): all pass.
const BAR_COLORS: Readonly<Record<ConflictType, string>> = {
  ROOM_DOUBLE_BOOK: '#2f6fc4',
  PROFESSOR_OVERLAP: '#b35c00',
  GROUP_OVERLAP: '#5b3a9e',
  ROOM_CAPACITY_EXCEEDED: '#a13d6f',
};

export default function ConflictBreakdownChart({
  counts,
  onBarClick,
}: ConflictBreakdownChartProps): React.ReactElement {
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) {
    return <Typography color="success.main">No conflicts to report</Typography>;
  }

  return (
    <BarChart
      dataset={counts as unknown as Record<string, unknown>[]}
      xAxis={[
        {
          scaleType: 'band',
          dataKey: 'label',
          colorMap: {
            type: 'ordinal',
            values: counts.map((c) => c.label),
            colors: counts.map((c) => BAR_COLORS[c.type]),
          },
        },
      ]}
      series={[{ dataKey: 'count', label: 'Conflicts' }]}
      onItemClick={(_event, item) => {
        const clicked = counts[item.dataIndex];
        if (clicked !== undefined) onBarClick?.(clicked.type);
      }}
      height={240}
      aria-label="Conflicts by type"
    />
  );
}
