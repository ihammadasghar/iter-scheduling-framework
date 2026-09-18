import { Box, Tooltip } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import type { OverlayBlock } from '@/utils/overlayLayout';

// Sibling to CalendarClassBlock.tsx, for the Edit Assignment dialog's
// multi-source overlay rather than the main app's personal-schedule
// calendar. The label text itself (e.g. "Room 204 busy") is what identifies
// which resource a block came from now, rather than color/icon — every
// non-editing block shares one neutral style.
interface OverlayClassBlockProps {
  readonly label: string;
  readonly tooltip: string;
  readonly block: OverlayBlock;
  readonly minMinutes: number;
  readonly pixelsPerMinute: number;
  readonly bgcolor: string;
  readonly color: string;
  // Only the 'editing' block passes an icon (Edit) — busy blocks omit it to
  // leave more width for the entity-name label text.
  readonly Icon?: SvgIconComponent;
  // Forwards to the same click-to-set-slot shortcut as clicking the empty
  // slot underneath would — the block can't be `pointer-events: none` to
  // pass clicks through on its own, since that would also block the hover
  // needed for the Tooltip below, so it explicitly re-triggers the same
  // slot instead.
  readonly onClick?: () => void;
  // Set only for the 'editing' source block: animates its position so
  // clicking a different slot (or changing Day/Period) slides the block
  // there instead of popping, giving the click-to-set shortcut some of the
  // direct-manipulation feel a drag would have had (issue #8).
  readonly animateMove?: boolean;
  // De-emphasizes every non-editing block (opacity 0.4) so the block being
  // edited stands out against the busy blocks around it (issue #29).
  readonly dimmed?: boolean;
  // Set only for the 'editing' source block: reuses
  // CalendarClassBlock.tsx/ClassChip.tsx's selected-class border/shadow
  // treatment so "the class I'm editing" reads as the same kind of
  // highlighted state as "the class I've selected" elsewhere in the app.
  readonly highlighted?: boolean;
}

const MIN_BLOCK_HEIGHT = 36;

export default function OverlayClassBlock({
  label,
  tooltip,
  block,
  minMinutes,
  pixelsPerMinute,
  bgcolor,
  color,
  Icon,
  onClick,
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
        onClick={onClick}
        sx={{
          position: 'absolute',
          top: `${top}px`,
          height: `${height}px`,
          left: `${leftPct}%`,
          width: `calc(${widthPct}% - 4px)`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
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
          {Icon && <Icon fontSize="inherit" sx={{ flexShrink: 0 }} />}
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
