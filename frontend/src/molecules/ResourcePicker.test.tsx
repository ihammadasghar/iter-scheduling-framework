import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ResourcePicker from './ResourcePicker';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { ViewByOption } from '@/types';

const makeStore = () =>
  configureStore({
    reducer: { schedule: scheduleReducer },
    preloadedState: {
      schedule: {
        rooms: [
          { id: 'RM_101', name: 'Room 101', capacity: 30, building: 'Main' },
          { id: 'RM_202', name: 'Room 202', capacity: 50, building: 'Annex' },
        ],
        professors: [
          { id: 'PRF_SMITH', name: 'Dr. Smith', department: 'Biology' },
        ],
        studentGroups: [
          { id: 'GRP_BIO_Y1', name: 'Biology Year 1', size: 40 },
        ],
        courses: [],
        timeSlots: [],
        loading: false,
        error: null,
      },
    },
  });

interface Harness {
  readonly resourceType: ViewByOption;
  readonly onResourceTypeChange: (t: ViewByOption) => void;
  readonly resourceId: string | null;
  readonly onResourceIdChange: (id: string | null) => void;
}

const renderPicker = (props: Partial<Harness> = {}) => {
  const store = makeStore();
  const onResourceTypeChange = props.onResourceTypeChange ?? vi.fn();
  const onResourceIdChange = props.onResourceIdChange ?? vi.fn();
  render(
    <Provider store={store}>
      <ResourcePicker
        resourceType={props.resourceType ?? 'room'}
        onResourceTypeChange={onResourceTypeChange}
        resourceId={props.resourceId ?? null}
        onResourceIdChange={onResourceIdChange}
      />
    </Provider>,
  );
  return { onResourceTypeChange, onResourceIdChange };
};

describe('ResourcePicker', () => {
  it('lists rooms in the search box when resourceType is room', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByLabelText('Search rooms'));
    expect(await screen.findByText('Room 101')).toBeInTheDocument();
    expect(screen.getByText('Room 202')).toBeInTheDocument();
  });

  it('filters options as the user types a name', async () => {
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole('combobox', { name: 'Search rooms' });
    await user.click(input);
    await user.type(input, '202');

    expect(await screen.findByText('Room 202')).toBeInTheDocument();
    expect(screen.queryByText('Room 101')).not.toBeInTheDocument();
  });

  it('fires onResourceIdChange with the selected option\'s id', async () => {
    const user = userEvent.setup();
    const { onResourceIdChange } = renderPicker();

    await user.click(screen.getByLabelText('Search rooms'));
    await user.click(await screen.findByText('Room 202'));

    expect(onResourceIdChange).toHaveBeenCalledWith('RM_202');
  });

  it('switching resource type resets the current selection', async () => {
    const user = userEvent.setup();
    const { onResourceIdChange } = renderPicker({ resourceType: 'room', resourceId: 'RM_101' });

    await user.click(screen.getByLabelText('Browse by resource type'));
    await user.click(await screen.findByRole('option', { name: 'Professor' }));

    expect(onResourceIdChange).toHaveBeenCalledWith(null);
  });

  it('shows professor options when resourceType is professor', async () => {
    const user = userEvent.setup();
    renderPicker({ resourceType: 'professor' });

    await user.click(screen.getByLabelText('Search professors'));
    expect(await screen.findByText('Dr. Smith')).toBeInTheDocument();
  });

  it('shows student group options when resourceType is studentGroup', async () => {
    const user = userEvent.setup();
    renderPicker({ resourceType: 'studentGroup' });

    await user.click(screen.getByLabelText('Search student groups'));
    expect(await screen.findByText('Biology Year 1')).toBeInTheDocument();
  });
});
