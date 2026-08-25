import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RemovedClassCard from './RemovedClassCard';
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

describe('RemovedClassCard', () => {
  it('renders the class title and a "Removed" badge', () => {
    render(<RemovedClassCard classItem={classItem} names={FORMATTER_NAMES} />);
    expect(screen.getByText('Intro to Biology Lecture')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
  });

  it('renders resolved names for course, professor, and room', () => {
    render(<RemovedClassCard classItem={classItem} names={FORMATTER_NAMES} />);
    expect(screen.getByText(/BIO101/)).toBeInTheDocument();
    expect(screen.getByText(/Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Room 101/)).toBeInTheDocument();
  });
});
