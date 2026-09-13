import { Card, CardContent, Stack, Typography } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  noConflicts: {
    id: 'healthSummaryTile.noConflicts',
    defaultMessage: 'No scheduling conflicts',
  },
  conflictsFound: {
    id: 'healthSummaryTile.conflictsFound',
    defaultMessage: '{count, plural, one {# scheduling conflict found} other {# scheduling conflicts found}}',
  },
});

interface HealthSummaryTileProps {
  readonly conflictCount: number;
}

export default function HealthSummaryTile({
  conflictCount,
}: HealthSummaryTileProps): React.ReactElement {
  const intl = useIntl();
  const healthy = conflictCount === 0;
  const label = healthy
    ? intl.formatMessage(messages.noConflicts)
    : intl.formatMessage(messages.conflictsFound, { count: conflictCount });

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center' }}
        >
          {healthy ? (
            <CheckCircle color="success" fontSize="large" aria-hidden />
          ) : (
            <Warning color="warning" fontSize="large" aria-hidden />
          )}
          <Typography variant="h5" component="p">
            {label}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
