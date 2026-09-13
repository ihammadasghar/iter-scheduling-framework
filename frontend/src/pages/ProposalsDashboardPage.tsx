import { useEffect } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';
import EmptyState from '@/atoms/EmptyState';
import ProposalCardSkeleton from '@/organisms/ProposalCardSkeleton';
import ProposalSection from '@/organisms/ProposalSection';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProposalsThunk, fetchBlockedProposalsThunk } from '@/store/reducers/proposalSlice';

const messages = defineMessages({
  title: {
    id: 'proposalsDashboardPage.title',
    defaultMessage: 'Proposals for Review',
  },
  refreshList: {
    id: 'proposalsDashboardPage.refreshList',
    defaultMessage: 'Refresh List',
  },
  loadError: {
    id: 'proposalsDashboardPage.loadError',
    defaultMessage: 'Could not load proposals. Please try again.',
  },
  noProposals: {
    id: 'proposalsDashboardPage.noProposals',
    defaultMessage: 'No proposals waiting for review.',
  },
  readyTitle: {
    id: 'proposalsDashboardPage.readyTitle',
    defaultMessage: 'Ready for Review',
  },
  readySubtitle: {
    id: 'proposalsDashboardPage.readySubtitle',
    defaultMessage: "Checked by the system — doesn't make the published schedule worse",
  },
  blockedTitle: {
    id: 'proposalsDashboardPage.blockedTitle',
    defaultMessage: 'Has Conflicts',
  },
  blockedSubtitle: {
    id: 'proposalsDashboardPage.blockedSubtitle',
    defaultMessage: 'Cannot be published until the conflicts are fixed',
  },
});

export default function ProposalsDashboardPage(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { proposals, blocked, loading, error } = useAppSelector((s) => s.proposal);

  const fetchAll = (): void => {
    dispatch(fetchProposalsThunk());
    dispatch(fetchBlockedProposalsThunk()); // Supplementary section — silently ignored on failure
  };

  useEffect(() => { fetchAll(); }, []);

  const isEmpty = proposals.length === 0 && blocked.length === 0;

  return (
    <AppShell>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h3" component="h1">
            {intl.formatMessage(messages.title)}
          </Typography>
          <Button
            variant="text"
            startIcon={<RefreshIcon />}
            onClick={fetchAll}
            disabled={loading}
          >
            {intl.formatMessage(messages.refreshList)}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {intl.formatMessage(messages.loadError)}
          </Alert>
        )}

        {loading && isEmpty && (
          <>
            <ProposalCardSkeleton />
            <ProposalCardSkeleton />
            <ProposalCardSkeleton />
          </>
        )}

        {!loading && isEmpty && !error && (
          <EmptyState
            Icon={InboxIcon}
            message={intl.formatMessage(messages.noProposals)}
          />
        )}

        <ProposalSection
          title={intl.formatMessage(messages.readyTitle)}
          subtitle={intl.formatMessage(messages.readySubtitle)}
          proposals={proposals}
          status="ready"
        />

        <ProposalSection
          title={intl.formatMessage(messages.blockedTitle)}
          subtitle={intl.formatMessage(messages.blockedSubtitle)}
          proposals={blocked}
          status="blocked"
        />
      </Box>
    </AppShell>
  );
}
