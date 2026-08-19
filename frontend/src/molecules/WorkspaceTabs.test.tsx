import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';

describe('WorkspaceTabs', () => {
  it('highlights the active tab', () => {
    render(<WorkspaceTabs value="grid" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Grid View' })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange with "overview" when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="grid" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });
});
