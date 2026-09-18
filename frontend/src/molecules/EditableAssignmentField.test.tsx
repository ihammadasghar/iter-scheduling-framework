import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import EditableAssignmentField from './EditableAssignmentField';

const OPTIONS = [
  { id: 'a', label: 'Room A', subtitle: 'Building 1 · Capacity 10' },
  { id: 'b', label: 'Room B', subtitle: 'Building 2 · Capacity 20' },
];

const renderField = (onChange: (id: string) => void = vi.fn()) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <EditableAssignmentField
        label="Room"
        valueText="Room A"
        subtitle="Building 1 · Capacity 10"
        options={OPTIONS}
        selectedId="a"
        onChange={onChange}
      />
    </IntlProvider>,
  );

describe('EditableAssignmentField', () => {
  it('renders the value and subtitle as plain text, with no dropdown visible', () => {
    renderField();
    expect(screen.getByText('Room A')).toBeInTheDocument();
    expect(screen.getByText('Building 1 · Capacity 10')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a menu of every option, with subtitles, when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: 'Change Room' }));

    expect(await screen.findByRole('menuitem', { name: /room b.*building 2.*capacity 20/is })).toBeInTheDocument();
  });

  it('calls onChange and closes the menu when an option is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderField(onChange);

    await user.click(screen.getByRole('button', { name: 'Change Room' }));
    await user.click(await screen.findByRole('menuitem', { name: /^room b/i }));

    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
