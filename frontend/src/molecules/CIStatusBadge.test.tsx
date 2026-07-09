import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CIStatusBadge from './CIStatusBadge';

describe('CIStatusBadge', () => {
  it('renders success chip for READY', () => {
    render(<CIStatusBadge status="READY" />);
    expect(screen.getByText('Checked — no conflicts')).toBeInTheDocument();
  });

  it('renders warning chip for BLOCKED', () => {
    render(<CIStatusBadge status="BLOCKED" />);
    expect(screen.getByText('Has scheduling conflicts')).toBeInTheDocument();
  });

  it('renders spinner chip for PENDING', () => {
    render(<CIStatusBadge status="PENDING" />);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });

  it('renders the disclaimer text', () => {
    render(<CIStatusBadge status="READY" />);
    expect(screen.getByText(/does not re-check/i)).toBeInTheDocument();
  });
});
