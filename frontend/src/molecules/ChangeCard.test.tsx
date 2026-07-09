import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChangeCard from './ChangeCard';
import type { ClassChange } from '@/utils/diffParser';

const change: ClassChange = {
  className: 'Biology 101 Lecture',
  changes: [
    { field: 'Room', from: 'Room 101 (Block A)', to: 'Room 201 (Block B)' },
    { field: 'Lecturer', from: 'Dr Smith', to: 'Dr Jones' },
  ],
};

describe('ChangeCard', () => {
  it('renders the class name', () => {
    render(<ChangeCard change={change} />);
    expect(screen.getByText('Biology 101 Lecture')).toBeInTheDocument();
  });

  it('renders field labels', () => {
    render(<ChangeCard change={change} />);
    expect(screen.getByText('Room')).toBeInTheDocument();
    expect(screen.getByText('Lecturer')).toBeInTheDocument();
  });

  it('renders from and to values', () => {
    render(<ChangeCard change={change} />);
    expect(screen.getByText('Room 101 (Block A)')).toBeInTheDocument();
    expect(screen.getByText('Room 201 (Block B)')).toBeInTheDocument();
    expect(screen.getByText('Dr Smith')).toBeInTheDocument();
    expect(screen.getByText('Dr Jones')).toBeInTheDocument();
  });
});
