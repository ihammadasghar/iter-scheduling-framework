import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';

describe('WorkspaceTabs', () => {
  it('highlights the active tab', () => {
    render(<WorkspaceTabs value="grid" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Full Schedule' })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange with "overview" when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="grid" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('calls onChange with "myschedule" when the My Schedule tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="grid" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'My Schedule' }));
    expect(onChange).toHaveBeenCalledWith('myschedule');
  });

  it('calls onChange with "grid" when the Full Schedule tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="myschedule" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Full Schedule' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });

  it('calls onChange with "browse" when the Browse tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="grid" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(onChange).toHaveBeenCalledWith('browse');
  });

  it('renders only the given subset of tabs, in the given order, when `tabs` is provided', () => {
    render(<WorkspaceTabs value="grid" onChange={vi.fn()} tabs={['grid', 'browse']} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Full Schedule', 'Browse']);
    expect(screen.queryByRole('tab', { name: 'My Schedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument();
  });
});
