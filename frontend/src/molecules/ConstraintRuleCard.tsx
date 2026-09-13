import { Box, Card, CardContent, CardActions, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { defineMessages, useIntl } from 'react-intl';
import { getTargetLabel, describeViolationCondition } from '@/utils/ruleLabels';
import type { Constraint } from '@/types';

const messages = defineMessages({
  appliesTo: {
    id: 'constraintRuleCard.appliesTo',
    defaultMessage: 'Applies to: {label}',
  },
  blocksWhen: {
    id: 'constraintRuleCard.blocksWhen',
    defaultMessage: 'Blocks when: {label}',
  },
  editTooltip: {
    id: 'constraintRuleCard.editTooltip',
    defaultMessage: 'Edit this constraint',
  },
  editAriaLabel: {
    id: 'constraintRuleCard.editAriaLabel',
    defaultMessage: 'Edit constraint: {name}',
  },
  deleteTooltip: {
    id: 'constraintRuleCard.deleteTooltip',
    defaultMessage: 'Delete this rule',
  },
  deleteAriaLabel: {
    id: 'constraintRuleCard.deleteAriaLabel',
    defaultMessage: 'Delete constraint: {name}',
  },
});

interface ConstraintRuleCardProps {
  readonly rule: Constraint;
  readonly onEdit: (rule: Constraint) => void;
  readonly onDelete: (id: string) => void;
  readonly disabled?: boolean;
}

export default function ConstraintRuleCard({
  rule,
  onEdit,
  onDelete,
  disabled = false,
}: ConstraintRuleCardProps): React.ReactElement {
  const intl = useIntl();
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
          {rule.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.appliesTo, { label: getTargetLabel(intl, rule.target) })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.blocksWhen, { label: describeViolationCondition(intl, rule.violationCondition, rule.limit) })}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip title={intl.formatMessage(messages.editTooltip)}>
          <Box component="span">
            <IconButton
              aria-label={intl.formatMessage(messages.editAriaLabel, { name: rule.name })}
              size="small"
              onClick={() => onEdit(rule)}
              disabled={disabled}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        <Tooltip title={intl.formatMessage(messages.deleteTooltip)}>
          <Box component="span">
            <IconButton
              aria-label={intl.formatMessage(messages.deleteAriaLabel, { name: rule.name })}
              size="small"
              color="error"
              onClick={() => onDelete(rule.id)}
              disabled={disabled}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
