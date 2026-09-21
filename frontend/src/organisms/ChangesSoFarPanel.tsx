import { Box, CircularProgress, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import ClassDiffPanel from '@/organisms/ClassDiffPanel';
import { useAppSelector } from '@/store/hooks';
import { useScheduleNames } from '@/hooks/useScheduleNames';

const messages = defineMessages({
  heading: {
    id: 'changesSoFarPanel.heading',
    defaultMessage: 'Changes So Far',
  },
  panelAriaLabel: {
    id: 'changesSoFarPanel.panelAriaLabel',
    defaultMessage: 'Changes made in this proposal so far',
  },
  loadingAriaLabel: {
    id: 'changesSoFarPanel.loadingAriaLabel',
    defaultMessage: 'Loading changes…',
  },
});

const PANEL_WIDTH = 380;

// Persistent right-hand column across all three workspace tabs, showing the
// same added/removed/changed class list the scheduling office sees on a
// submitted proposal's review page — surfaced live, before submission.
export default function ChangesSoFarPanel(): React.ReactElement {
  const intl = useIntl();
  const diff = useAppSelector((s) => s.diff.diff);
  const loading = useAppSelector((s) => s.diff.loading);
  const names = useScheduleNames();

  return (
    <Box
      component="aside"
      aria-label={intl.formatMessage(messages.panelAriaLabel)}
      sx={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        borderLeft: '1px solid',
        borderColor: 'divider',
        overflowY: 'auto',
        p: 2,
      }}
    >
      <Typography variant="h6" component="h2" gutterBottom>
        {intl.formatMessage(messages.heading)}
      </Typography>
      {loading && diff === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} aria-label={intl.formatMessage(messages.loadingAriaLabel)} />
        </Box>
      ) : (
        <ClassDiffPanel classDiff={diff ?? { added: [], removed: [], changed: [] }} names={names} />
      )}
    </Box>
  );
}
