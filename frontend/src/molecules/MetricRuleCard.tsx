import { Box, Card, CardContent, CardActions, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getTargetLabel, getConditionLabel, getDirectionLabel } from '@/utils/ruleLabels';
import type { MetricRule } from '@/types';

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
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
          {rule.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Measures: {getTargetLabel(rule.target)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          How: {getConditionLabel(rule.condition)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Target value: {rule.threshold}
        </Typography>
        {rule.direction && (
          <Typography variant="body2" color="text.secondary">
            Direction: {getDirectionLabel(rule.direction)}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Weight: {rule.weight}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip title="Edit this rule">
          <Box component="span">
            <IconButton
              aria-label={`Edit metric rule: ${rule.name}`}
              size="small"
              onClick={() => onEdit(rule)}
              disabled={disabled}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </Tooltip>
        <Tooltip title="Delete this rule">
          <Box component="span">
            <IconButton
              aria-label={`Delete metric rule: ${rule.name}`}
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
