import { BarChart } from '@mui/x-charts/BarChart';
import { Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { ConflictTypeCount } from '@/utils/groupConflictsByType';
import type { ConflictType } from '@/types';

const messages = defineMessages({
  noConflicts: {
    id: 'conflictBreakdownChart.noConflicts',
    defaultMessage: 'No conflicts to report',
  },
  seriesLabel: {
    id: 'conflictBreakdownChart.seriesLabel',
    defaultMessage: 'Conflicts',
  },
  ariaLabel: {
    id: 'conflictBreakdownChart.ariaLabel',
    defaultMessage: 'Conflicts by type',
  },
});

interface ConflictBreakdownChartProps {
  readonly counts: readonly ConflictTypeCount[];
  readonly onBarClick?: (type: ConflictType) => void;
}

// Validated categorical palette (see docs/superpowers/specs/2026-07-24-simulation-overview-visualizations-design.md).
// ROOM_CAPACITY_EXCEEDED's rose slot was added after that spec landed — re-validated
// via the dataviz skill's validate_palette.js (adjacent-pairs, light mode): all pass.
// CONSECUTIVE_LIMIT_EXCEEDED/GAP_LIMIT_EXCEEDED's green/red slots (from the
// skill's reference palette) were added the same way, appended in this fixed
// adjacent order — validate_palette.js reports a CVD WARN on the green↔red
// pair (6-8 band), legal because this chart already carries visible direct
// labels (the x-axis band label under every bar), same mitigation the skill
// requires for a WARN.
const BAR_COLORS: Readonly<Record<ConflictType, string>> = {
  ROOM_DOUBLE_BOOK: '#2f6fc4',
  PROFESSOR_OVERLAP: '#b35c00',
  GROUP_OVERLAP: '#5b3a9e',
  ROOM_CAPACITY_EXCEEDED: '#a13d6f',
  CONSECUTIVE_LIMIT_EXCEEDED: '#008300',
  GAP_LIMIT_EXCEEDED: '#e34948',
};

export default function ConflictBreakdownChart({
  counts,
  onBarClick,
}: ConflictBreakdownChartProps): React.ReactElement {
  const intl = useIntl();
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) {
    return <Typography color="success.main">{intl.formatMessage(messages.noConflicts)}</Typography>;
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
      series={[{ dataKey: 'count', label: intl.formatMessage(messages.seriesLabel) }]}
      onItemClick={(_event, item) => {
        const clicked = counts[item.dataIndex];
        if (clicked !== undefined) onBarClick?.(clicked.type);
      }}
      height={240}
      aria-label={intl.formatMessage(messages.ariaLabel)}
    />
  );
}
