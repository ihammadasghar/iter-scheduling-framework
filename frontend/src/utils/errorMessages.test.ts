import { describe, it, expect } from 'vitest';
import { createIntl } from 'react-intl';
import { getErrorMessage } from './errorMessages';

const intl = createIntl({ locale: 'en', messages: {} });

describe('getErrorMessage', () => {
  it('maps INTERNAL_SERVER_ERROR to plain English', () => {
    expect(getErrorMessage(intl, 'INTERNAL_SERVER_ERROR')).toBe(
      'Something went wrong on our end. Please try again.',
    );
  });

  it('maps CONFLICT to merge-specific message', () => {
    expect(getErrorMessage(intl, 'CONFLICT')).toContain('scheduling conflicts');
  });

  it('maps NOT_IMPLEMENTED to IT department message', () => {
    expect(getErrorMessage(intl, 'NOT_IMPLEMENTED')).toContain('IT department');
  });

  it('maps NOT_FOUND with simulation context', () => {
    expect(getErrorMessage(intl, 'NOT_FOUND', 'simulation')).toContain('timed out');
  });

  it('maps NOT_FOUND with merge context', () => {
    expect(getErrorMessage(intl, 'NOT_FOUND', 'merge')).toContain('already been published');
  });

  it('maps NOT_FOUND with default context', () => {
    expect(getErrorMessage(intl, 'NOT_FOUND', 'general')).toContain('could not be found');
  });

  it('returns fallback message for unknown codes', () => {
    expect(getErrorMessage(intl, 'UNKNOWN_CODE')).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('is a pure function — same input gives same output', () => {
    const a = getErrorMessage(intl, 'INTERNAL_SERVER_ERROR');
    const b = getErrorMessage(intl, 'INTERNAL_SERVER_ERROR');
    expect(a).toBe(b);
  });

  it('uses general context as default when omitted', () => {
    expect(getErrorMessage(intl, 'NOT_FOUND')).toBe(getErrorMessage(intl, 'NOT_FOUND', 'general'));
  });
});
