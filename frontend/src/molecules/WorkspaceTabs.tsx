import { Tabs, Tab } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';

export type WorkspaceTabValue = 'myschedule' | 'grid' | 'browse' | 'overview';

const messages = defineMessages({
  myschedule: { id: 'workspaceTabs.mySchedule', defaultMessage: 'My Schedule' },
  grid: { id: 'workspaceTabs.fullSchedule', defaultMessage: 'Full Schedule' },
  browse: { id: 'workspaceTabs.browse', defaultMessage: 'Browse' },
  overview: { id: 'workspaceTabs.overview', defaultMessage: 'Overview' },
  ariaLabel: { id: 'workspaceTabs.ariaLabel', defaultMessage: 'Timetable workspace view' },
});

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
  const intl = useIntl();
  return (
    <Tabs
      value={value}
      onChange={(_e, newValue: WorkspaceTabValue) => onChange(newValue)}
      aria-label={intl.formatMessage(messages.ariaLabel)}
    >
      {tabs.map((tabValue) => (
        <Tab key={tabValue} value={tabValue} label={intl.formatMessage(messages[tabValue])} />
      ))}
    </Tabs>
  );
}
