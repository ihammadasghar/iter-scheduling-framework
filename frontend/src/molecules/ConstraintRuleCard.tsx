import { Box, Card, CardContent, CardActions, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { getTargetLabel, describeViolationCondition } from '@/utils/ruleLabels';
import type { Constraint } from '@/types';

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
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} gutterBottom>
          {rule.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Applies to: {getTargetLabel(rule.target)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Blocks when: {describeViolationCondition(rule.violationCondition, rule.limit)}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Tooltip title="Edit this constraint">
          <Box component="span">
            <IconButton
              aria-label={`Edit constraint: ${rule.name}`}
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
              aria-label={`Delete constraint: ${rule.name}`}
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
