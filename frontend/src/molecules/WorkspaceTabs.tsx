import { Tabs, Tab } from '@mui/material';

export type WorkspaceTabValue = 'myschedule' | 'grid' | 'browse' | 'overview';

const TAB_CONFIG: Record<WorkspaceTabValue, { readonly label: string }> = {
  myschedule: { label: 'My Schedule' },
  grid: { label: 'Full Schedule' },
  browse: { label: 'Browse' },
  overview: { label: 'Overview' },
};

const DEFAULT_TABS: readonly WorkspaceTabValue[] = ['myschedule', 'grid', 'browse', 'overview'];

interface WorkspaceTabsProps {
  readonly value: WorkspaceTabValue;
  readonly onChange: (value: WorkspaceTabValue) => void;
  // Which tabs to render, in order. Defaults to all four (the simulation
  // workspace). PublishedSchedulePage passes a smaller subset — it has no
  // per-simulation session, so no conflicts/metrics for Overview and no
  // redundant "My Schedule" (the Dashboard already covers that).
  readonly tabs?: readonly WorkspaceTabValue[];
}

export default function WorkspaceTabs({ value, onChange, tabs = DEFAULT_TABS }: WorkspaceTabsProps): React.ReactElement {
  return (
    <Tabs
      value={value}
      onChange={(_e, newValue: WorkspaceTabValue) => onChange(newValue)}
      aria-label="Timetable workspace view"
    >
      {tabs.map((tabValue) => (
        <Tab key={tabValue} value={tabValue} label={TAB_CONFIG[tabValue].label} />
      ))}
    </Tabs>
  );
}
