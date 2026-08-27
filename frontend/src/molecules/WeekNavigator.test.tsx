import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeekNavigator from './WeekNavigator';
import { mondayOf } from '@/utils/weekNavigation';
import type { ScheduleTimeline } from '@/types';

const TIMELINE: ScheduleTimeline = {
  semesterStartDate: '2026-09-07',
  semesterEndDate: '2026-12-18',
  exclusionDates: [],
};

describe('WeekNavigator', () => {
  it('renders the week-range label', () => {
    render(<WeekNavigator weekStart="2026-09-07" onWeekChange={vi.fn()} timeline={TIMELINE} />);
    expect(screen.getByText('Sep 7 – Sep 13, 2026')).toBeInTheDocument();
  });

  it('clicking Next week calls onWeekChange with the following Monday', async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();
    render(<WeekNavigator weekStart="2026-09-07" onWeekChange={onWeekChange} timeline={TIMELINE} />);

    await user.click(screen.getByLabelText('Next week'));

    expect(onWeekChange).toHaveBeenCalledWith('2026-09-14');
  });

  it('clicking Previous week calls onWeekChange with the prior Monday', async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();
    render(<WeekNavigator weekStart="2026-09-14" onWeekChange={onWeekChange} timeline={TIMELINE} />);

    await user.click(screen.getByLabelText('Previous week'));

    expect(onWeekChange).toHaveBeenCalledWith('2026-09-07');
  });

  it('disables Previous week at the semester\'s first week', () => {
    render(
      <WeekNavigator
        weekStart={mondayOf(TIMELINE.semesterStartDate)}
        onWeekChange={vi.fn()}
        timeline={TIMELINE}
      />,
    );
    expect(screen.getByLabelText('Previous week')).toBeDisabled();
    expect(screen.getByLabelText('Next week')).not.toBeDisabled();
  });

  it('disables Next week at the semester\'s last week', () => {
    render(
      <WeekNavigator
        weekStart={mondayOf(TIMELINE.semesterEndDate)}
        onWeekChange={vi.fn()}
        timeline={TIMELINE}
      />,
    );
    expect(screen.getByLabelText('Next week')).toBeDisabled();
    expect(screen.getByLabelText('Previous week')).not.toBeDisabled();
  });
});
