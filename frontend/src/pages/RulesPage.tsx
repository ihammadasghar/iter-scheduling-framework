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
import { defineMessages, useIntl } from 'react-intl';
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
import type { MetricRule, Constraint } from '@/types';

const messages = defineMessages({
  ruleDeleted: {
    id: 'rulesPage.ruleDeleted',
    defaultMessage: 'Rule deleted',
  },
  constraintDeleted: {
    id: 'rulesPage.constraintDeleted',
    defaultMessage: 'Constraint deleted',
  },
  metricRulesHeading: {
    id: 'rulesPage.metricRulesHeading',
    defaultMessage: 'Metric Rules',
  },
  metricRulesSubtitle: {
    id: 'rulesPage.metricRulesSubtitle',
    defaultMessage: "Influence the score — a proposal can still be submitted if it scores poorly on these.",
  },
  addMetric: {
    id: 'rulesPage.addMetric',
    defaultMessage: '+ Add Metric',
  },
  noMetricRules: {
    id: 'rulesPage.noMetricRules',
    defaultMessage: 'No metric rules configured yet.',
  },
  constraintsHeading: {
    id: 'rulesPage.constraintsHeading',
    defaultMessage: 'Hard Constraints',
  },
  constraintsSubtitle: {
    id: 'rulesPage.constraintsSubtitle',
    defaultMessage: 'Violating one blocks the proposal outright — it cannot be submitted.',
  },
  addConstraint: {
    id: 'rulesPage.addConstraint',
    defaultMessage: '+ Add Constraint',
  },
  noConstraints: {
    id: 'rulesPage.noConstraints',
    defaultMessage: 'No hard constraints configured yet.',
  },
  title: {
    id: 'rulesPage.title',
    defaultMessage: 'Rules & Constraints',
  },
  unavailable: {
    id: 'rulesPage.unavailable',
    defaultMessage: 'The rules configuration service is not available yet. Please contact your IT department.',
  },
  metricRuleUpdated: {
    id: 'rulesPage.metricRuleUpdated',
    defaultMessage: 'Metric rule updated',
  },
  metricRuleAdded: {
    id: 'rulesPage.metricRuleAdded',
    defaultMessage: 'Metric rule added',
  },
  constraintUpdated: {
    id: 'rulesPage.constraintUpdated',
    defaultMessage: 'Constraint updated',
  },
  constraintAdded: {
    id: 'rulesPage.constraintAdded',
    defaultMessage: 'Constraint added',
  },
  deleteMetricRuleTitle: {
    id: 'rulesPage.deleteMetricRuleTitle',
    defaultMessage: 'Delete Metric Rule?',
  },
  deleteConstraintTitle: {
    id: 'rulesPage.deleteConstraintTitle',
    defaultMessage: 'Delete Constraint?',
  },
  deleteConfirmBody: {
    id: 'rulesPage.deleteConfirmBody',
    defaultMessage: 'Are you sure you want to delete "{name}"? This cannot be undone.',
  },
  cancel: {
    id: 'rulesPage.cancel',
    defaultMessage: 'Cancel',
  },
  yesDelete: {
    id: 'rulesPage.yesDelete',
    defaultMessage: 'Yes, Delete',
  },
});

type DeleteTarget = { kind: 'metric' | 'constraint'; id: string; name: string } | null;

export default function RulesPage(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { metrics, constraints, loading, unavailable } = useAppSelector((s) => s.rules);

  const [addMetricOpen, setAddMetricOpen] = useState(false);
  const [addConstraintOpen, setAddConstraintOpen] = useState(false);
  const [editMetricTarget, setEditMetricTarget] = useState<MetricRule | null>(null);
  const [editConstraintTarget, setEditConstraintTarget] = useState<Constraint | null>(null);
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
    showSnackbar(deleteTarget.kind === 'metric' ? intl.formatMessage(messages.ruleDeleted) : intl.formatMessage(messages.constraintDeleted));
  };

  const metricSection = (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
        {intl.formatMessage(messages.metricRulesHeading)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {intl.formatMessage(messages.metricRulesSubtitle)}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setAddMetricOpen(true)}
        disabled={unavailable || loading}
        sx={{ mb: 2 }}
      >
        {intl.formatMessage(messages.addMetric)}
      </Button>

      {loading && metrics.length === 0 && (
        <>
          <RuleCardSkeleton />
          <RuleCardSkeleton />
        </>
      )}

      {!loading && metrics.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.noMetricRules)}
        </Typography>
      )}

      {metrics.map((rule) => (
        <MetricRuleCard
          key={rule.id}
          rule={rule}
          onEdit={setEditMetricTarget}
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
      <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
        {intl.formatMessage(messages.constraintsHeading)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {intl.formatMessage(messages.constraintsSubtitle)}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => setAddConstraintOpen(true)}
        disabled={unavailable || loading}
        sx={{ mb: 2 }}
      >
        {intl.formatMessage(messages.addConstraint)}
      </Button>

      {loading && constraints.length === 0 && (
        <>
          <RuleCardSkeleton />
          <RuleCardSkeleton />
        </>
      )}

      {!loading && constraints.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.noConstraints)}
        </Typography>
      )}

      {constraints.map((rule) => (
        <ConstraintRuleCard
          key={rule.id}
          rule={rule}
          onEdit={setEditConstraintTarget}
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
          {intl.formatMessage(messages.title)}
        </Typography>

        {unavailable && (
          <Alert severity="info" sx={{ mb: 3 }}>
            {intl.formatMessage(messages.unavailable)}
          </Alert>
        )}

        <TwoColumnLayout left={metricSection} right={constraintSection} />

        {/* Add/Edit dialogs — one instance of each shared between create and
            edit; existingRule is set only for the edit flow. */}
        <AddMetricDialog
          open={addMetricOpen || editMetricTarget !== null}
          onClose={() => {
            setAddMetricOpen(false);
            setEditMetricTarget(null);
          }}
          onSuccess={() => showSnackbar(editMetricTarget ? intl.formatMessage(messages.metricRuleUpdated) : intl.formatMessage(messages.metricRuleAdded))}
          existingRule={editMetricTarget ?? undefined}
        />
        <AddConstraintDialog
          open={addConstraintOpen || editConstraintTarget !== null}
          onClose={() => {
            setAddConstraintOpen(false);
            setEditConstraintTarget(null);
          }}
          onSuccess={() => showSnackbar(editConstraintTarget ? intl.formatMessage(messages.constraintUpdated) : intl.formatMessage(messages.constraintAdded))}
          existingRule={editConstraintTarget ?? undefined}
        />

        {/* Delete confirmation */}
        <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
          <DialogTitle>{deleteTarget?.kind === 'metric' ? intl.formatMessage(messages.deleteMetricRuleTitle) : intl.formatMessage(messages.deleteConstraintTitle)}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {intl.formatMessage(messages.deleteConfirmBody, { name: deleteTarget?.name ?? '' })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>{intl.formatMessage(messages.cancel)}</Button>
            <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
              {intl.formatMessage(messages.yesDelete)}
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
