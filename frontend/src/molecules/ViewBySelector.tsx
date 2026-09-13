import { FormControl, InputLabel, MenuItem, Select, Tooltip } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setViewBy } from '@/store/reducers/uiSlice';
import { getResourceTypeLabels } from '@/utils/resourceTypeLabels';
import type { ViewByOption } from '@/types';

const messages = defineMessages({
  viewBy: {
    id: 'viewBySelector.viewBy',
    defaultMessage: 'View by',
  },
  viewByAriaLabel: {
    id: 'viewBySelector.viewByAriaLabel',
    defaultMessage: 'View timetable by',
  },
  viewByOption: {
    id: 'viewBySelector.viewByOption',
    defaultMessage: 'View by {resourceType}',
  },
  roomTooltip: {
    id: 'viewBySelector.roomTooltip',
    defaultMessage: 'Rows show each room; see which classes are scheduled in each space.',
  },
  professorTooltip: {
    id: 'viewBySelector.professorTooltip',
    defaultMessage: 'Rows show each professor; spot scheduling gaps or overloads at a glance.',
  },
  studentGroupTooltip: {
    id: 'viewBySelector.studentGroupTooltip',
    defaultMessage: 'Rows show each student group; check for timetable clashes for students.',
  },
});

export default function ViewBySelector(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const viewBy = useAppSelector((s) => s.ui.viewBy);
  const resourceTypeLabels = getResourceTypeLabels(intl);

  const viewOptions: ReadonlyArray<{ value: ViewByOption; label: string; tooltip: string }> = [
    {
      value: 'room',
      label: intl.formatMessage(messages.viewByOption, { resourceType: resourceTypeLabels.room }),
      tooltip: intl.formatMessage(messages.roomTooltip),
    },
    {
      value: 'professor',
      label: intl.formatMessage(messages.viewByOption, { resourceType: resourceTypeLabels.professor }),
      tooltip: intl.formatMessage(messages.professorTooltip),
    },
    {
      value: 'studentGroup',
      label: intl.formatMessage(messages.viewByOption, { resourceType: resourceTypeLabels.studentGroup }),
      tooltip: intl.formatMessage(messages.studentGroupTooltip),
    },
  ];

  const handleChange = (e: SelectChangeEvent<ViewByOption>): void => {
    dispatch(setViewBy(e.target.value as ViewByOption));
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="view-by-label">{intl.formatMessage(messages.viewBy)}</InputLabel>
      <Select<ViewByOption>
        labelId="view-by-label"
        value={viewBy}
        label={intl.formatMessage(messages.viewBy)}
        onChange={handleChange}
        inputProps={{ 'aria-label': intl.formatMessage(messages.viewByAriaLabel) }}
      >
        {viewOptions.map(({ value, label, tooltip }) => (
          // Tooltip must wrap MenuItem's content, not MenuItem itself — Select
          // reads `child.props.value` off its *immediate* children, and a
          // Tooltip child has no `value` prop, which silently breaks
          // selection (see ViewBySelector.test.tsx for the regression this
          // guards against).
          <MenuItem key={value} value={value}>
            {/* describeChild keeps the span's own text ("View by Room") as its
                accessible name (via aria-describedby) — without it, Tooltip
                defaults to overwriting the name with an aria-label set to the
                tooltip text itself, hiding the real label from screen readers. */}
            <Tooltip title={tooltip} placement="right" enterDelay={300} describeChild>
              <span>{label}</span>
            </Tooltip>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
