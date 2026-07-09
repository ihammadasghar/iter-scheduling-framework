import { FormControl, InputLabel, MenuItem, Select, Tooltip } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setViewBy } from '@/store/reducers/uiSlice';
import type { ViewByOption } from '@/types';

const VIEW_OPTIONS: ReadonlyArray<{ value: ViewByOption; label: string; tooltip: string }> = [
  {
    value: 'room',
    label: 'View by Room',
    tooltip: 'Rows show each room; see which classes are scheduled in each space.',
  },
  {
    value: 'professor',
    label: 'View by Professor',
    tooltip: 'Rows show each professor; spot scheduling gaps or overloads at a glance.',
  },
  {
    value: 'studentGroup',
    label: 'View by Student Group',
    tooltip: 'Rows show each student group; check for timetable clashes for students.',
  },
];

export default function ViewBySelector(): React.ReactElement {
  const dispatch = useAppDispatch();
  const viewBy = useAppSelector((s) => s.ui.viewBy);

  const handleChange = (e: SelectChangeEvent<ViewByOption>): void => {
    dispatch(setViewBy(e.target.value as ViewByOption));
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="view-by-label">View by</InputLabel>
      <Select<ViewByOption>
        labelId="view-by-label"
        value={viewBy}
        label="View by"
        onChange={handleChange}
        inputProps={{ 'aria-label': 'View timetable by' }}
      >
        {VIEW_OPTIONS.map(({ value, label, tooltip }) => (
          <Tooltip key={value} title={tooltip} placement="right" enterDelay={300}>
            <MenuItem value={value}>{label}</MenuItem>
          </Tooltip>
        ))}
      </Select>
    </FormControl>
  );
}
