import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Snackbar,
  Skeleton,
  Typography,
} from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';
import BackButton from '@/atoms/BackButton';
import CIStatusBadge from '@/molecules/CIStatusBadge';
import ClassDiffPanel from '@/organisms/ClassDiffPanel';
import MetricsComparisonPanel from '@/organisms/MetricsComparisonPanel';
import ConflictsComparisonPanel from '@/organisms/ConflictsComparisonPanel';
import TechnicalDiffAccordion from '@/organisms/TechnicalDiffAccordion';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProposalDetailThunk, mergeProposalThunk, rejectProposalThunk } from '@/store/reducers/proposalSlice';
import { fetchPublishedScheduleThunk } from '@/store/reducers/scheduleSlice';
import { buildScheduleNames } from '@/utils/scheduleNames';
import { evaluateProposalGate } from '@/utils/proposalGate';
import { useDateFnsLocale } from '@/utils/useDateFnsLocale';
import type { ProposalStatus } from '@/types';

const messages = defineMessages({
  publishSuccess: {
    id: 'proposalReviewPage.publishSuccess',
    defaultMessage: 'Changes published to the live timetable ✓',
  },
  publishConflictError: {
    id: 'proposalReviewPage.publishConflictError',
    defaultMessage: 'This proposal cannot be published because it has unresolved scheduling conflicts.',
  },
  publishGenericError: {
    id: 'proposalReviewPage.publishGenericError',
    defaultMessage: 'Could not publish proposal. Please try again.',
  },
  closeSuccess: {
    id: 'proposalReviewPage.closeSuccess',
    defaultMessage: 'Proposal closed.',
  },
  closeError: {
    id: 'proposalReviewPage.closeError',
    defaultMessage: 'Could not close proposal. Please try again.',
  },
  loadError: {
    id: 'proposalReviewPage.loadError',
    defaultMessage: 'Could not load proposal details. Please try again.',
  },
  title: {
    id: 'proposalReviewPage.title',
    defaultMessage: 'Proposal Review',
  },
  submitted: {
    id: 'proposalReviewPage.submitted',
    defaultMessage: 'Submitted {date}',
  },
  descriptionSuffix: {
    id: 'proposalReviewPage.descriptionSuffix',
    defaultMessage: ' — "{description}"',
  },
  automatedCheck: {
    id: 'proposalReviewPage.automatedCheck',
    defaultMessage: 'Automated Check',
  },
  gateAcceptableReduced: {
    id: 'proposalReviewPage.gateAcceptableReduced',
    defaultMessage: 'This proposal can be approved: it has {candidate} scheduling conflict(s), down from {baseline} currently published.',
  },
  gateAcceptableScoreChanged: {
    id: 'proposalReviewPage.gateAcceptableScoreChanged',
    defaultMessage: 'This proposal can be approved: it keeps the same number of scheduling conflicts as published ({count}), and changes the overall weighted score.',
  },
  gateBlocked: {
    id: 'proposalReviewPage.gateBlocked',
    defaultMessage: "This proposal likely can't be approved yet: it has {candidate} scheduling conflict(s) vs {baseline} currently published, with no change to the weighted score. Proposals are only accepted if they reduce conflicts or change the score.",
  },
  metricsHeading: {
    id: 'proposalReviewPage.metricsHeading',
    defaultMessage: 'Metrics: Published vs. This Proposal',
  },
  conflictsHeading: {
    id: 'proposalReviewPage.conflictsHeading',
    defaultMessage: 'Constraint Violations: Published vs. This Proposal',
  },
  changesHeading: {
    id: 'proposalReviewPage.changesHeading',
    defaultMessage: 'Changes in this Proposal',
  },
  approveAndPublish: {
    id: 'proposalReviewPage.approveAndPublish',
    defaultMessage: '✅ Approve & Publish',
  },
  closeProposal: {
    id: 'proposalReviewPage.closeProposal',
    defaultMessage: 'Close This Proposal',
  },
  publishDialogTitle: {
    id: 'proposalReviewPage.publishDialogTitle',
    defaultMessage: 'Publish Changes?',
  },
  publishDialogBody: {
    id: 'proposalReviewPage.publishDialogBody',
    defaultMessage: 'You are about to publish these changes to the live timetable. This will affect students and lecturers. Are you sure?',
  },
  cancel: {
    id: 'proposalReviewPage.cancel',
    defaultMessage: 'Cancel',
  },
  yesPublish: {
    id: 'proposalReviewPage.yesPublish',
    defaultMessage: 'Yes, Publish Changes',
  },
  closeDialogTitle: {
    id: 'proposalReviewPage.closeDialogTitle',
    defaultMessage: 'Close This Proposal?',
  },
  closeDialogBody: {
    id: 'proposalReviewPage.closeDialogBody',
    defaultMessage: "Are you sure you want to close this proposal? The lecturer's draft will be kept and they can make adjustments and resubmit.",
  },
  yesClose: {
    id: 'proposalReviewPage.yesClose',
    defaultMessage: 'Yes, Close Proposal',
  },
});

type ConfirmDialog = 'approve' | 'close' | null;

const isCiStatus = (s: ProposalStatus): s is 'READY' | 'BLOCKED' | 'PENDING' =>
  s === 'READY' || s === 'BLOCKED' || s === 'PENDING';

export default function ProposalReviewPage(): React.ReactElement {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const dateFnsLocale = useDateFnsLocale();

  const { current: proposal, loading, error } = useAppSelector((s) => s.proposal);
  const { rooms, professors, courses, studentGroups } = useAppSelector((s) => s.schedule);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    if (id) dispatch(fetchProposalDetailThunk(id));
    dispatch(fetchPublishedScheduleThunk());
  }, [dispatch, id]);

  const names = buildScheduleNames(rooms, professors, courses, studentGroups);
  const gate = proposal ? evaluateProposalGate(proposal.comparison) : null;

  const handleApprove = async (): Promise<void> => {
    if (!id) return;
    setActionLoading(true);
    setInlineError(null);
    const result = await dispatch(mergeProposalThunk(id));
    setActionLoading(false);
    setConfirmDialog(null);
    if (mergeProposalThunk.fulfilled.match(result)) {
      setSnackbar({ open: true, message: intl.formatMessage(messages.publishSuccess), severity: 'success' });
      setTimeout(() => navigate('/admin/proposals'), 1500);
    } else {
      const statusCode = (result.payload as { statusCode?: number } | undefined)?.statusCode;
      if (statusCode === 409) {
        setInlineError(intl.formatMessage(messages.publishConflictError));
      } else {
        setInlineError(intl.formatMessage(messages.publishGenericError));
      }
    }
  };

  const handleClose = async (): Promise<void> => {
    if (!id) return;
    setActionLoading(true);
    setInlineError(null);
    const result = await dispatch(rejectProposalThunk(id));
    setActionLoading(false);
    setConfirmDialog(null);
    if (rejectProposalThunk.fulfilled.match(result)) {
      setSnackbar({ open: true, message: intl.formatMessage(messages.closeSuccess), severity: 'info' });
      setTimeout(() => navigate('/admin/proposals'), 1500);
    } else {
      setInlineError(intl.formatMessage(messages.closeError));
    }
  };

  return (
    <AppShell>
      <Box sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 4 }}>
        <BackButton />

        {loading && !proposal && (
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="40%" height={24} sx={{ mt: 1 }} />
            <Skeleton variant="rectangular" height={80} sx={{ mt: 3 }} />
            <Skeleton variant="rectangular" height={120} sx={{ mt: 2 }} />
          </Box>
        )}

        {error && !proposal && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {intl.formatMessage(messages.loadError)}
          </Alert>
        )}

        {proposal && (
          <>
            <Typography variant="h3" component="h1" sx={{ mt: 2, mb: 0.5 }}>
              {intl.formatMessage(messages.title)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {intl.formatMessage(messages.submitted, { date: format(new Date(proposal.createdAt), 'PP', { locale: dateFnsLocale }) })}
              {proposal.description && intl.formatMessage(messages.descriptionSuffix, { description: proposal.description })}
            </Typography>

            {/* CI Status */}
            {isCiStatus(proposal.status) && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  {intl.formatMessage(messages.automatedCheck)}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <CIStatusBadge status={proposal.status} />
                </Box>
              </Box>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* Metrics comparison */}
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(messages.metricsHeading)}
            </Typography>
            <Box sx={{ mb: 4 }}>
              <MetricsComparisonPanel
                baselineScore={proposal.comparison.baselineScore}
                candidateScore={proposal.comparison.candidateScore}
              />
            </Box>

            {/* Conflicts comparison */}
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(messages.conflictsHeading)}
            </Typography>
            <Box sx={{ mb: 4 }}>
              <ConflictsComparisonPanel
                baselineConflicts={proposal.comparison.baselineConflicts}
                candidateConflicts={proposal.comparison.candidateConflicts}
                conflictDelta={proposal.comparison.conflictDelta}
              />
            </Box>

            {/* Changes */}
            <Typography variant="h6" gutterBottom>
              {intl.formatMessage(messages.changesHeading)}
            </Typography>
            <Box sx={{ mb: 3 }}>
              <ClassDiffPanel classDiff={proposal.comparison.classDiff} names={names} />
            </Box>

            <TechnicalDiffAccordion rawDiff={proposal.diff} />

            {/* Explicit gate-rule explanation, computed from the same live
                comparison data rendered above — surfaced up front so the
                real accept/reject rule doesn't only show up as a 409 after
                the user clicks Approve. */}
            {gate && (
              <Alert severity={gate.acceptable ? 'success' : 'warning'} sx={{ mt: 3 }}>
                {gate.acceptable
                  ? intl.formatMessage(
                      gate.conflictsReduced ? messages.gateAcceptableReduced : messages.gateAcceptableScoreChanged,
                      { candidate: gate.candidateConflictCount, baseline: gate.baselineConflictCount, count: gate.candidateConflictCount },
                    )
                  : intl.formatMessage(messages.gateBlocked, {
                      candidate: gate.candidateConflictCount,
                      baseline: gate.baselineConflictCount,
                    })}
              </Alert>
            )}

            {/* Inline error */}
            {inlineError && (
              <Alert severity="error" sx={{ mt: 3 }} onClose={() => setInlineError(null)}>
                {inlineError}
              </Alert>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 4, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                onClick={() => setConfirmDialog('approve')}
                disabled={actionLoading}
              >
                {intl.formatMessage(messages.approveAndPublish)}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setConfirmDialog('close')}
                disabled={actionLoading}
              >
                {intl.formatMessage(messages.closeProposal)}
              </Button>
            </Box>
          </>
        )}

        {/* Approve confirmation dialog */}
        <Dialog open={confirmDialog === 'approve'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>{intl.formatMessage(messages.publishDialogTitle)}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {intl.formatMessage(messages.publishDialogBody)}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
            >
              {intl.formatMessage(messages.yesPublish)}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close confirmation dialog */}
        <Dialog open={confirmDialog === 'close'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>{intl.formatMessage(messages.closeDialogTitle)}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {intl.formatMessage(messages.closeDialogBody)}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
              {intl.formatMessage(messages.cancel)}
            </Button>
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
            >
              {intl.formatMessage(messages.yesClose)}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </AppShell>
  );
}
