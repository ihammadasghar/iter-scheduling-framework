import { Tabs, Tab } from '@mui/material';

export type WorkspaceTabValue = 'grid' | 'overview';

interface WorkspaceTabsProps {
  readonly value: WorkspaceTabValue;
  readonly onChange: (value: WorkspaceTabValue) => void;
}

export default function WorkspaceTabs({ value, onChange }: WorkspaceTabsProps): React.ReactElement {
  return (
    <Tabs
      value={value}
      onChange={(_e, newValue: WorkspaceTabValue) => onChange(newValue)}
      aria-label="Timetable workspace view"
    >
      <Tab value="grid" label="Grid View" />
      <Tab value="overview" label="Overview" />
    </Tabs>
  );
}
