import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SuggestionCard, { DeltaChip } from './SuggestionCard';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { MetricDelta, ScheduleClass, Suggestion } from '@/types';

const currentClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const suggestion: Suggestion = {
  roomId: 'RM_204',
  timeSlotIds: ['TS_TUE_P2'],
  conflictFree: true,
};

const renderCard = (overrides: Partial<React.ComponentProps<typeof SuggestionCard>> = {}) => {
  const store = configureStore({ reducer: { schedule: scheduleReducer } });
  return render(
    <Provider store={store}>
      <SuggestionCard
        suggestion={suggestion}
        currentClass={currentClass}
        onApply={vi.fn()}
        applying={false}
        loadingDelta={false}
        {...overrides}
      />
    </Provider>,
  );
};

describe('SuggestionCard', () => {
  it('shows the current room and time so the change reads as a move, not a slot in isolation', () => {
    renderCard();
    expect(screen.getByText(/currently: room 101/i)).toBeInTheDocument();
  });

  it('shows the suggested room and time as the destination', () => {
    renderCard();
    expect(screen.getByText(/move to room 204 · tuesday period 2/i)).toBeInTheDocument();
  });

  it('labels the Apply button with the destination room, not a bare "Apply"', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /move biology 101 to room 204/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^apply$/i })).not.toBeInTheDocument();
  });

  it('shows "No conflicts" when the suggestion is conflict-free', () => {
    renderCard({ suggestion: { ...suggestion, conflictFree: true } });
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('shows a warning instead of a false "No conflicts" claim when the suggestion is not conflict-free', () => {
    renderCard({ suggestion: { ...suggestion, conflictFree: false } });
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
    expect(screen.getByText(/may still conflict/i)).toBeInTheDocument();
  });

  it('calls onApply when the button is clicked', () => {
    const onApply = vi.fn();
    renderCard({ onApply });
    fireEvent.click(screen.getByRole('button', { name: /move biology 101 to room 204/i }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it('disables the button and shows "Applying…" while applying', () => {
    renderCard({ applying: true });
    const button = screen.getByRole('button', { name: /move biology 101 to room 204/i });
    expect(button).toBeDisabled();
    expect(screen.getByText('Applying…')).toBeInTheDocument();
  });

  it('falls back to "no time set" when the current class has no time slots', () => {
    renderCard({ currentClass: { ...currentClass, timeSlotIds: [] } });
    expect(screen.getByText(/currently: room 101 · no time set/i)).toBeInTheDocument();
  });
});

describe('DeltaChip', () => {
  // The second fixed instance of the MetricDeltaTile bug (see that file's
  // test) — same shared MetricDelta type, same direction-aware fix.
  const chipColor = (delta: MetricDelta): string => {
    const { container } = render(<DeltaChip delta={delta} />);
    return within(container).getByLabelText(/metric change/i).className;
  };

  it('colors a lower-is-better decrease as improved (green), not regressed', () => {
    const decreaseClass = chipColor({ name: 'Avg Gap', before: 5, after: 2, unit: ' slots', direction: 'lower_is_better' });
    const plainIncreaseClass = chipColor({ name: 'Room Utilization', before: 50, after: 70, unit: '%' });
    expect(decreaseClass).toContain('colorSuccess');
    expect(decreaseClass).toBe(plainIncreaseClass);
  });

  it('colors a lower-is-better increase as regressed (red), not improved', () => {
    const increaseClass = chipColor({ name: 'Avg Gap', before: 2, after: 5, unit: ' slots', direction: 'lower_is_better' });
    const plainDecreaseClass = chipColor({ name: 'Room Utilization', before: 70, after: 50, unit: '%' });
    expect(increaseClass).toContain('colorError');
    expect(increaseClass).toBe(plainDecreaseClass);
  });
});
