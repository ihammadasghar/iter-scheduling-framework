import { Box, Button, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

interface EmptyStateProps {
  readonly Icon: SvgIconComponent;
  readonly message: string;
  readonly ctaLabel?: string;
  readonly onCta?: () => void;
}

/**
 * Reusable centred empty state — icon, message, and optional CTA button.
 */
export default function EmptyState({
  Icon,
  message,
  ctaLabel,
  onCta,
}: EmptyStateProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        py: 8,
        px: 2,
        textAlign: 'center',
        maxWidth: 400,
        mx: 'auto',
      }}
    >
      <Icon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      {ctaLabel !== undefined && onCta !== undefined && (
        <Button variant="contained" size="large" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </Box>
  );
}
