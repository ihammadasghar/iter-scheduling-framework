import { Box, Skeleton } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  ariaLabel: {
    id: 'inspectorSkeleton.ariaLabel',
    defaultMessage: 'Loading class details…',
  },
});

/**
 * Skeleton panel shown while the inspector is transitioning to a newly selected class.
 */
export default function InspectorSkeleton(): React.ReactElement {
  const intl = useIntl();
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} aria-label={intl.formatMessage(messages.ariaLabel)}>
      {/* Header */}
      <Skeleton variant="text" width="70%" height={32} />
      <Skeleton variant="text" width="45%" height={20} />

      {/* Detail rows */}
      <Skeleton variant="text" width="90%" height={20} />
      <Skeleton variant="text" width="80%" height={20} />
      <Skeleton variant="text" width="85%" height={20} />

      {/* Suggestions section header */}
      <Skeleton variant="text" width="55%" height={20} sx={{ mt: 2 }} />

      {/* Suggestion cards */}
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rounded" height={100} />
      ))}
    </Box>
  );
}
