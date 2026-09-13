import { useMemo } from 'react';
import { Autocomplete, Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppSelector } from '@/store/hooks';
import { getResourceTypeLabels } from '@/utils/resourceTypeLabels';
import type { ViewByOption } from '@/types';

const messages = defineMessages({
  browseBy: {
    id: 'resourcePicker.browseBy',
    defaultMessage: 'Browse by',
  },
  browseByAriaLabel: {
    id: 'resourcePicker.browseByAriaLabel',
    defaultMessage: 'Browse by resource type',
  },
  searchPlaceholder: {
    id: 'resourcePicker.searchPlaceholder',
    defaultMessage: 'Type a name…',
  },
  searchLabel: {
    id: 'resourcePicker.searchLabel',
    defaultMessage: 'Search {resourceType}s',
  },
});

interface ResourcePickerProps {
  readonly resourceType: ViewByOption;
  readonly onResourceTypeChange: (type: ViewByOption) => void;
  readonly resourceId: string | null;
  readonly onResourceIdChange: (id: string | null) => void;
}

interface ResourceOption {
  readonly id: string;
  readonly label: string;
}

/**
 * The Browse tab's lookup control: pick a resource type (Room / Professor /
 * Student Group), then search for one specific instance by name. Switching
 * type clears the current selection — an id from one entity space is
 * meaningless in another. Unlike ViewBySelector (which only re-groups the
 * Full Schedule grid's rows), this drills into a single entity's own weekly
 * calendar via MyScheduleCalendar's `resource` prop.
 */
export default function ResourcePicker({
  resourceType,
  onResourceTypeChange,
  resourceId,
  onResourceIdChange,
}: ResourcePickerProps): React.ReactElement {
  const intl = useIntl();
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const professors = useAppSelector((s) => s.schedule.professors);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const resourceTypeLabels = getResourceTypeLabels(intl);

  const options = useMemo<ResourceOption[]>(() => {
    if (resourceType === 'room') return rooms.map((r) => ({ id: r.id, label: r.name }));
    if (resourceType === 'professor') return professors.map((p) => ({ id: p.id, label: p.name }));
    return studentGroups.map((g) => ({ id: g.id, label: g.name }));
  }, [resourceType, rooms, professors, studentGroups]);

  const selectedOption = options.find((o) => o.id === resourceId) ?? null;

  const handleTypeChange = (e: SelectChangeEvent<ViewByOption>): void => {
    onResourceTypeChange(e.target.value as ViewByOption);
    onResourceIdChange(null);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="resource-type-label">{intl.formatMessage(messages.browseBy)}</InputLabel>
        <Select<ViewByOption>
          labelId="resource-type-label"
          value={resourceType}
          label={intl.formatMessage(messages.browseBy)}
          onChange={handleTypeChange}
          inputProps={{ 'aria-label': intl.formatMessage(messages.browseByAriaLabel) }}
        >
          {(Object.entries(resourceTypeLabels) as Array<[ViewByOption, string]>).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Autocomplete<ResourceOption>
        size="small"
        sx={{ minWidth: 280 }}
        options={options}
        value={selectedOption}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_e, newValue) => onResourceIdChange(newValue?.id ?? null)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={intl.formatMessage(messages.searchLabel, { resourceType: resourceTypeLabels[resourceType].toLowerCase() })}
            placeholder={intl.formatMessage(messages.searchPlaceholder)}
          />
        )}
      />
    </Box>
  );
}
