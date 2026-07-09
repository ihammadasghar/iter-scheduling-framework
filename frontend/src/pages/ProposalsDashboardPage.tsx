import { useEffect } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import AppShell from '@/templates/AppShell';
import EmptyState from '@/atoms/EmptyState';
import ProposalCardSkeleton from '@/organisms/ProposalCardSkeleton';
import ProposalSection from '@/organisms/ProposalSection';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProposalsThunk, fetchBlockedProposalsThunk } from '@/store/reducers/proposalSlice';

export default function ProposalsDashboardPage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const { proposals, blocked, loading, error } = useAppSelector((s) => s.proposal);

  const fetchAll = (): void => {
    dispatch(fetchProposalsThunk());
    dispatch(fetchBlockedProposalsThunk()); // Gap 2 — silently ignored on failure
  };

  useEffect(() => { fetchAll(); }, []);

  const isEmpty = proposals.length === 0 && blocked.length === 0;

  return (
    <AppShell>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h3" component="h1">
            Proposals for Review
          </Typography>
          <Button
            variant="text"
            startIcon={<RefreshIcon />}
            onClick={fetchAll}
            disabled={loading}
          >
            Refresh List
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Could not load proposals. Please try again.
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
            message="No proposals waiting for review."
          />
        )}

        <ProposalSection
          title="Ready for Review"
          subtitle="Checked by the system — no scheduling conflicts found"
          proposals={proposals}
          status="ready"
        />

        <ProposalSection
          title="Has Conflicts"
          subtitle="Cannot be published until the conflicts are fixed"
          proposals={blocked}
          status="blocked"
        />
      </Box>
    </AppShell>
  );
}
