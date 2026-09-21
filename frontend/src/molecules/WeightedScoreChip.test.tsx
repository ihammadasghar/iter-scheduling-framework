import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import WeightedScoreChip from './WeightedScoreChip';
import type { WeightedScoreResult } from '@/types';

const SCORE: WeightedScoreResult = {
  score: 82,
  breakdown: [
    { name: 'Room utilisation', value: 78, unit: '%', weight: 2, threshold: 80, normalizedScore: 90 },
  ],
};

const renderChip = (score: WeightedScoreResult) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <WeightedScoreChip score={score} />
    </IntlProvider>,
  );

describe('WeightedScoreChip', () => {
  it('shows the score out of 100', () => {
    renderChip(SCORE);
    expect(screen.getByText(/institutional preference score: 82\/100/i)).toBeInTheDocument();
  });

  it('explains what the score means and how metrics compose into it, on hover', async () => {
    const user = userEvent.setup();
    renderChip(SCORE);
    await user.hover(screen.getByText(/institutional preference score: 82\/100/i));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/weighted average/i);
    expect(tooltip).toHaveTextContent(/room utilisation/i);
  });

  it('explains that no score can be computed when no metrics are configured', () => {
    renderChip({ score: 0, breakdown: [] });
    expect(screen.getByText(/no preferences defined/i)).toBeInTheDocument();
  });
});
