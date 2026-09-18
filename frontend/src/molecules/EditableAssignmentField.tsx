import { useState } from 'react';
import {
  Box, IconButton, Menu, MenuItem, Typography,
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  editAriaLabel: {
    id: 'editableAssignmentField.editAriaLabel',
    defaultMessage: 'Change {label}',
  },
});

export interface EditableAssignmentFieldOption {
  readonly id: string;
  readonly label: string;
  readonly subtitle?: string;
}

interface EditableAssignmentFieldProps {
  readonly label: string;
  readonly valueText: string;
  readonly subtitle?: string;
  readonly options: readonly EditableAssignmentFieldOption[];
  readonly selectedId: string;
  readonly onChange: (id: string) => void;
}

/**
 * A read-only "label: value" row (matching ClassDetailSection's DetailRow)
 * with a small Edit button that pops up just this field's options in a
 * Menu — instead of an always-live dropdown competing for attention with
 * the overlay calendar, which is the primary way to change a class's
 * assignment.
 */
export default function EditableAssignmentField({
  label,
  valueText,
  subtitle,
  options,
  selectedId,
  onChange,
}: EditableAssignmentFieldProps): React.ReactElement {
  const intl = useIntl();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleSelect = (id: string): void => {
    onChange(id);
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, flexShrink: 0, fontSize: 14 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ fontSize: 16 }}>{valueText}</Typography>
        {subtitle !== undefined && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label={intl.formatMessage(messages.editAriaLabel, { label })}
      >
        <Edit fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={anchorEl !== null} onClose={() => setAnchorEl(null)}>
        {options.map((opt) => (
          <MenuItem key={opt.id} selected={opt.id === selectedId} onClick={() => handleSelect(opt.id)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
              <Typography variant="body2">{opt.label}</Typography>
              {opt.subtitle !== undefined && (
                <Typography variant="caption" color="text.secondary">{opt.subtitle}</Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
