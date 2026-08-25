import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClassDiffPanel from './ClassDiffPanel';
import { FORMATTER_NAMES } from '@/utils/scheduleNames';
import type { RawClass, ScheduleDiff } from '@/types';

const EMPTY_DIFF: ScheduleDiff = { added: [], removed: [], changed: [] };

const CLASS: RawClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Intro to Biology Lecture',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

describe('ClassDiffPanel', () => {
  it('shows an empty state when there are no changes', () => {
    render(<ClassDiffPanel classDiff={EMPTY_DIFF} names={FORMATTER_NAMES} />);
    expect(screen.getByText('No changes detected in this proposal.')).toBeInTheDocument();
  });

  it('renders added classes under a "New Classes" heading', () => {
    render(<ClassDiffPanel classDiff={{ ...EMPTY_DIFF, added: [CLASS] }} names={FORMATTER_NAMES} />);
    expect(screen.getByText('New Classes (1)')).toBeInTheDocument();
    expect(screen.getByText('Intro to Biology Lecture')).toBeInTheDocument();
  });

  it('renders removed classes under a "Removed Classes" heading', () => {
    render(<ClassDiffPanel classDiff={{ ...EMPTY_DIFF, removed: [CLASS] }} names={FORMATTER_NAMES} />);
    expect(screen.getByText('Removed Classes (1)')).toBeInTheDocument();
  });

  it('renders changed classes under a "Changed Classes" heading', () => {
    const changed = [{
      classId: 'CLS_001',
      before: CLASS,
      after: { ...CLASS, roomId: 'RM_102' },
      fieldChanges: [{ field: 'roomId' as const, before: 'RM_101', after: 'RM_102' }],
    }];
    render(<ClassDiffPanel classDiff={{ ...EMPTY_DIFF, changed }} names={FORMATTER_NAMES} />);
    expect(screen.getByText('Changed Classes (1)')).toBeInTheDocument();
    expect(screen.getByText('Room')).toBeInTheDocument();
  });

  it('renders mixed added/removed/changed sections together', () => {
    const changed = [{
      classId: 'CLS_002',
      before: { ...CLASS, id: 'CLS_002' },
      after: { ...CLASS, id: 'CLS_002', roomId: 'RM_102' },
      fieldChanges: [{ field: 'roomId' as const, before: 'RM_101', after: 'RM_102' }],
    }];
    render(
      <ClassDiffPanel
        classDiff={{ added: [CLASS], removed: [{ ...CLASS, id: 'CLS_003' }], changed }}
        names={FORMATTER_NAMES}
      />,
    );
    expect(screen.getByText('New Classes (1)')).toBeInTheDocument();
    expect(screen.getByText('Removed Classes (1)')).toBeInTheDocument();
    expect(screen.getByText('Changed Classes (1)')).toBeInTheDocument();
  });
});
