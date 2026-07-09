import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AppShell from '@/templates/AppShell';
import TwoColumnLayout from '@/templates/TwoColumnLayout';
import MetricRuleCard from '@/molecules/MetricRuleCard';
import ConstraintRuleCard from '@/molecules/ConstraintRuleCard';
import AddMetricDialog from '@/molecules/AddMetricDialog';
import AddConstraintDialog from '@/molecules/AddConstraintDialog';
import RuleCardSkeleton from '@/organisms/RuleCardSkeleton';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchMetricRulesThunk,
  fetchConstraintsThunk,
  deleteMetricRuleThunk,
  deleteConstraintThunk,
} from '@/store/reducers/rulesSlice';

type DeleteTarget = { kind: 'metric' | 'constraint'; id: string; name: string } | null;

export default function RulesPage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const { metrics, constraints, loading, unavailable } = useAppSelector((s) => s.rules);

  const [addMetricOpen, setAddMetricOpen] = useState(false);
  const [addConstraintOpen, setAddConstraintOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  useEffect(() => {
    dispatch(fetchMetricRulesThunk());
    dispatch(fetchConstraintsThunk());
  }, [dispatch]);

  const showSnackbar = (message: string): void =>
    setSnackbar({ open: true, message });

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    const thunk = deleteTarget.kind === 'metric'
      ? deleteMetricRuleThunk(deleteTarget.id)
      : deleteConstraintThunk(deleteTarget.id);
    await dispatch(thunk);
    setDeleteTarget(null);
    showSnackbar(deleteTarget.kind === 'metric' ? 'Rule deleted' : 'Constraint deleted');
  };

  const metricSection = (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Metric Rules
      </Typography>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setAddMetricOpen(true)}
        disabled={unavailable || loading}
        sx={{ mb: 2 }}
      >
        + Add Metric
      </Button>

      {loading && metrics.length === 0 && (
        <>
          <RuleCardSkeleton />
          <RuleCardSkeleton />
        </>
      )}

      {!loading && metrics.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No metric rules configured yet.
        </Typography>
      )}

      {metrics.map((rule) => (
        <MetricRuleCard
          key={rule.id}
          rule={rule}
          onDelete={(id) =>
            setDeleteTarget({ kind: 'metric', id, name: rule.name })
          }
          disabled={unavailable}
        />
      ))}
    </Box>
  );

  const constraintSection = (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Hard Constraints
      </Typography>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setAddConstraintOpen(true)}
        disabled={unavailable || loading}
        sx={{ mb: 2 }}
      >
        + Add Constraint
      </Button>

      {loading && constraints.length === 0 && (
        <>
          <RuleCardSkeleton />
          <RuleCardSkeleton />
        </>
      )}

      {!loading && constraints.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No hard constraints configured yet.
        </Typography>
      )}

      {constraints.map((rule) => (
        <ConstraintRuleCard
          key={rule.id}
          rule={rule}
          onDelete={(id) =>
            setDeleteTarget({ kind: 'constraint', id, name: rule.name })
          }
          disabled={unavailable}
        />
      ))}
    </Box>
  );

  return (
    <AppShell>
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, py: 4 }}>
        <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
          Rules &amp; Constraints
        </Typography>

        {unavailable && (
          <Alert severity="info" sx={{ mb: 3 }}>
            The rules configuration service is not available yet. Please contact your IT department.
          </Alert>
        )}

        <TwoColumnLayout left={metricSection} right={constraintSection} />

        {/* Add dialogs */}
        <AddMetricDialog
          open={addMetricOpen}
          onClose={() => setAddMetricOpen(false)}
          onSuccess={() => showSnackbar('Metric rule added')}
        />
        <AddConstraintDialog
          open={addConstraintOpen}
          onClose={() => setAddConstraintOpen(false)}
          onSuccess={() => showSnackbar('Constraint added')}
        />

        {/* Delete confirmation */}
        <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>Delete {deleteTarget?.kind === 'metric' ? 'Metric Rule' : 'Constraint'}?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
              Yes, Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          message={snackbar.message}
        />
      </Box>
    </AppShell>
  );
}
