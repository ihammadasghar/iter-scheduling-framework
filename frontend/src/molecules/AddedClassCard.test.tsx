import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AddedClassCard from './AddedClassCard';
import { FORMATTER_NAMES } from '@/utils/scheduleNames';
import type { RawClass } from '@/types';

const classItem: RawClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Intro to Biology Lecture',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

describe('AddedClassCard', () => {
  it('renders the class title and a "New" badge', () => {
    render(<AddedClassCard classItem={classItem} names={FORMATTER_NAMES} />);
    expect(screen.getByText('Intro to Biology Lecture')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders resolved names for course, professor, room, and group', () => {
    render(<AddedClassCard classItem={classItem} names={FORMATTER_NAMES} />);
    expect(screen.getByText(/BIO101/)).toBeInTheDocument();
    expect(screen.getByText(/Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Room 101/)).toBeInTheDocument();
  });
});
