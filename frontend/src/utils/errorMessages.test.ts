import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errorMessages';

describe('getErrorMessage', () => {
  it('maps INTERNAL_SERVER_ERROR to plain English', () => {
    expect(getErrorMessage('INTERNAL_SERVER_ERROR')).toBe(
      'Something went wrong on our end. Please try again.',
    );
  });

  it('maps CONFLICT to merge-specific message', () => {
    expect(getErrorMessage('CONFLICT')).toContain('scheduling conflicts');
  });

  it('maps NOT_IMPLEMENTED to IT department message', () => {
    expect(getErrorMessage('NOT_IMPLEMENTED')).toContain('IT department');
  });

  it('maps NOT_FOUND with simulation context', () => {
    expect(getErrorMessage('NOT_FOUND', 'simulation')).toContain('timed out');
  });

  it('maps NOT_FOUND with merge context', () => {
    expect(getErrorMessage('NOT_FOUND', 'merge')).toContain('already been published');
  });

  it('maps NOT_FOUND with default context', () => {
    expect(getErrorMessage('NOT_FOUND', 'general')).toContain('could not be found');
  });

  it('returns fallback message for unknown codes', () => {
    expect(getErrorMessage('UNKNOWN_CODE')).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('is a pure function — same input gives same output', () => {
    const a = getErrorMessage('INTERNAL_SERVER_ERROR');
    const b = getErrorMessage('INTERNAL_SERVER_ERROR');
    expect(a).toBe(b);
  });

  it('uses general context as default when omitted', () => {
    expect(getErrorMessage('NOT_FOUND')).toBe(getErrorMessage('NOT_FOUND', 'general'));
  });
});
