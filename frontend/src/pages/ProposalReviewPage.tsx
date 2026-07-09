import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import AppShell from '@/templates/AppShell';
import BackButton from '@/atoms/BackButton';
import CIStatusBadge from '@/molecules/CIStatusBadge';
import ChangeCard from '@/molecules/ChangeCard';
import TechnicalDiffAccordion from '@/organisms/TechnicalDiffAccordion';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProposalDetailThunk, mergeProposalThunk, rejectProposalThunk } from '@/store/reducers/proposalSlice';
import { parseDiff } from '@/utils/diffParser';
import type { ScheduleJson } from '@/types/schedule';
import type { ProposalStatus } from '@/types';

// Minimal empty schedule for safe fallback when master data is unavailable
const EMPTY_SCHEDULE: ScheduleJson = {
  metadata: { semesterId: '', semesterName: '', academicYear: '' },
  timeSlots: [],
  rooms: [],
  professors: [],
  studentGroups: [],
  courses: [],
  classes: [],
};

type ConfirmDialog = 'approve' | 'close' | null;

const isCiStatus = (s: ProposalStatus): s is 'READY' | 'BLOCKED' | 'PENDING' =>
  s === 'READY' || s === 'BLOCKED' || s === 'PENDING';

export default function ProposalReviewPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { current: proposal, loading, error } = useAppSelector((s) => s.proposal);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  useEffect(() => {
    if (id) dispatch(fetchProposalDetailThunk(id));
  }, [dispatch, id]);

  const schedule = EMPTY_SCHEDULE; // schedule master data would come from a dedicated slice in a future task
  const changes = proposal?.diff ? parseDiff(proposal.diff, schedule) : [];

  const handleApprove = async (): Promise<void> => {
    if (!id) return;
    setActionLoading(true);
    setInlineError(null);
    const result = await dispatch(mergeProposalThunk(id));
    setActionLoading(false);
    setConfirmDialog(null);
    if (mergeProposalThunk.fulfilled.match(result)) {
      setSnackbar({ open: true, message: 'Changes published to the live timetable ✓', severity: 'success' });
      setTimeout(() => navigate('/admin/proposals'), 1500);
    } else {
      const statusCode = (result.payload as { statusCode?: number } | undefined)?.statusCode;
      if (statusCode === 409) {
        setInlineError('This proposal cannot be published because it has unresolved scheduling conflicts.');
      } else {
        setInlineError('Could not publish proposal. Please try again.');
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
      setSnackbar({ open: true, message: 'Proposal closed.', severity: 'info' });
      setTimeout(() => navigate('/admin/proposals'), 1500);
    } else {
      // Gap 3: reject not implemented — show graceful message
      setInlineError('This feature is not available yet.');
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
            Could not load proposal details. Please try again.
          </Alert>
        )}

        {proposal && (
          <>
            <Typography variant="h3" component="h1" sx={{ mt: 2, mb: 0.5 }}>
              Proposal Review
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Submitted {new Date(proposal.createdAt).toLocaleDateString()}
              {proposal.description && ` — "${proposal.description}"`}
            </Typography>

            {/* CI Status */}
            {isCiStatus(proposal.status) && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Automated Check
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <CIStatusBadge status={proposal.status} />
                </Box>
              </Box>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* Changes */}
            <Typography variant="h6" gutterBottom>
              Changes in this Proposal
            </Typography>

            {changes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No class assignment changes detected in this proposal.
              </Typography>
            ) : (
              changes.map((change, idx) => <ChangeCard key={idx} change={change} />)
            )}

            <TechnicalDiffAccordion rawDiff={proposal.diff} />

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
                ✅ Approve &amp; Publish
              </Button>
              <Button
                variant="outlined"
                onClick={() => setConfirmDialog('close')}
                disabled={actionLoading}
              >
                Close This Proposal
              </Button>
            </Box>
          </>
        )}

        {/* Approve confirmation dialog */}
        <Dialog open={confirmDialog === 'approve'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>Publish Changes?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              You are about to publish these changes to the live timetable. This will affect
              students and lecturers. Are you sure?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
            >
              Yes, Publish Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close confirmation dialog */}
        <Dialog open={confirmDialog === 'close'} onClose={() => setConfirmDialog(null)}>
          <DialogTitle>Close This Proposal?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to close this proposal? The lecturer&apos;s draft will be
              kept and they can make adjustments and resubmit.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={actionLoading}
              startIcon={actionLoading ? <CircularProgress size={16} /> : undefined}
            >
              Yes, Close Proposal
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
