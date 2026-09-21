import { Box, Card, CardContent, CardActions, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { defineMessages, useIntl } from 'react-intl';
import { getTargetLabel, getConditionLabel, getDirectionLabel } from '@/utils/ruleLabels';
import type { MetricRule } from '@/types';

const messages = defineMessages({
  measures: {
    id: 'metricRuleCard.measures',
    defaultMessage: 'Measures: {label}',
  },
  how: {
    id: 'metricRuleCard.how',
    defaultMessage: 'How: {label}',
  },
  targetValue: {
    id: 'metricRuleCard.targetValue',
    defaultMessage: 'Goal value: {value}',
  },
  direction: {
    id: 'metricRuleCard.direction',
    defaultMessage: 'Direction: {label}',
  },
  weight: {
    id: 'metricRuleCard.weight',
    defaultMessage: 'Importance: {value}',
  },
  editTooltip: {
    id: 'metricRuleCard.editTooltip',
    defaultMessage: 'Edit this preference',
  },
  editAriaLabel: {
    id: 'metricRuleCard.editAriaLabel',
    defaultMessage: 'Edit institutional preference: {name}',
  },
  deleteTooltip: {
    id: 'metricRuleCard.deleteTooltip',
    defaultMessage: 'Delete this preference',
  },
  deleteAriaLabel: {
    id: 'metricRuleCard.deleteAriaLabel',
    defaultMessage: 'Delete institutional preference: {name}',
  },
});

interface MetricRuleCardProps {
  readonly rule: MetricRule;
  readonly onEdit: (rule: MetricRule) => void;
  readonly onDelete: (id: string) => void;
  readonly disabled?: boolean;
}

export default function MetricRuleCard({
  rule,
  onEdit,
  onDelete,
  disabled = false,
}: MetricRuleCardProps): React.ReactElement {
  const intl = useIntl();
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
          {rule.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.measures, { label: getTargetLabel(intl, rule.target) })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.how, { label: getConditionLabel(intl, rule.condition) })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.targetValue, { value: rule.threshold })}
        </Typography>
        {rule.direction && (
          <Typography variant="body2" color="text.secondary">
            {intl.formatMessage(messages.direction, { label: getDirectionLabel(intl, rule.direction) })}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.weight, { value: rule.weight })}
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
