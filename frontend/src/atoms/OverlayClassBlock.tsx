import { Box, Tooltip } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { OverlayBlock } from '@/utils/overlayLayout';

// Sibling to CalendarClassBlock.tsx, for the Edit Assignment dialog's
// multi-source overlay rather than the main app's personal-schedule
// calendar — purely informational here (no click-to-select-class
// navigation), colored by which resource's schedule it came from instead of
// conflict/selection state, so `pointerEvents: 'none'` lets every click pass
// through to the day column's per-timeslot click-to-set region underneath.
interface OverlayClassBlockProps {
  readonly label: string;
  readonly tooltip: string;
  readonly block: OverlayBlock;
  readonly minMinutes: number;
  readonly pixelsPerMinute: number;
  readonly bgcolor: string;
  readonly color: string;
  readonly Icon: SvgIconComponent;
  // Set only for the 'editing' source block: animates its position so
  // clicking a different slot (or changing Day/Period) slides the block
  // there instead of popping, giving the click-to-set shortcut some of the
  // direct-manipulation feel a drag would have had (issue #8).
  readonly animateMove?: boolean;
  // De-emphasizes this block (opacity 0.4) when a different source is
  // currently in focus — mirrors CalendarClassBlock.tsx/ClassChip.tsx's
  // selection-dimming idiom (issue #7), applied here to "which source" is
  // in focus instead of "which class is selected" (issue #29).
  readonly dimmed?: boolean;
  // Set only for the 'editing' source block: reuses
  // CalendarClassBlock.tsx/ClassChip.tsx's selected-class border/shadow
  // treatment so "the class I'm editing" reads as the same kind of
  // highlighted state as "the class I've selected" elsewhere in the app.
  readonly highlighted?: boolean;
}

const MIN_BLOCK_HEIGHT = 32;

export default function OverlayClassBlock({
  label,
  tooltip,
  block,
  minMinutes,
  pixelsPerMinute,
  bgcolor,
  color,
  Icon,
  animateMove = false,
  dimmed = false,
  highlighted = false,
}: OverlayClassBlockProps): React.ReactElement {
  const top = (block.startMinutes - minMinutes) * pixelsPerMinute;
  const height = Math.max((block.endMinutes - block.startMinutes) * pixelsPerMinute, MIN_BLOCK_HEIGHT);
  const widthPct = 100 / block.laneCount;
  const leftPct = widthPct * block.laneIndex;

  return (
    <Tooltip title={tooltip} enterDelay={300}>
      <Box
        aria-label={tooltip}
        sx={{
          position: 'absolute',
          top: `${top}px`,
          height: `${height}px`,
          left: `${leftPct}%`,
          width: `calc(${widthPct}% - 4px)`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          pointerEvents: 'none',
          borderRadius: 1,
          border: highlighted ? 2 : 0,
          borderColor: highlighted ? 'primary.main' : 'transparent',
          boxShadow: highlighted ? 4 : 1,
          opacity: dimmed ? 0.4 : 1,
          transition: animateMove
            ? 'top 0.2s ease-out, left 0.2s ease-out, opacity 0.15s'
            : 'opacity 0.15s',
          px: 0.75,
          py: 0.25,
          fontSize: '0.7rem',
          fontWeight: 600,
          bgcolor,
          color,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Icon fontSize="inherit" sx={{ flexShrink: 0 }} />
          <Box
            component="span"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              lineHeight: 1.15,
            }}
          >
            {label}
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );
}
