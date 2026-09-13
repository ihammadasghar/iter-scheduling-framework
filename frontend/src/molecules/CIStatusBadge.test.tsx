import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import CIStatusBadge from './CIStatusBadge';

const renderBadge = (status: 'READY' | 'BLOCKED' | 'PENDING') =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <CIStatusBadge status={status} />
    </IntlProvider>,
  );

describe('CIStatusBadge', () => {
  it('renders success chip for READY', () => {
    renderBadge('READY');
    expect(screen.getByText('Checked — no conflicts')).toBeInTheDocument();
  });

  it('renders warning chip for BLOCKED', () => {
    renderBadge('BLOCKED');
    expect(screen.getByText('Has scheduling conflicts')).toBeInTheDocument();
  });

  it('renders spinner chip for PENDING', () => {
    renderBadge('PENDING');
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });

  it('renders the disclaimer text', () => {
    renderBadge('READY');
    expect(screen.getByText(/does not re-check/i)).toBeInTheDocument();
  });
});
