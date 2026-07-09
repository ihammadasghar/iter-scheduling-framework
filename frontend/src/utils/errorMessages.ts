// Pure function mapping API error codes/contexts to plain English messages.
// Never exposes HTTP status codes, technical error codes, or stack traces to users.

export type ErrorContext = 'simulation' | 'merge' | 'rules' | 'general';

const ERROR_MAP: Record<string, string> = {
  INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again.',
  CONFLICT: 'This proposal cannot be published yet — it still has scheduling conflicts.',
  NOT_IMPLEMENTED: 'This feature is not available yet. Please contact your IT department.',
};

const CONTEXT_NOT_FOUND: Record<ErrorContext, string> = {
  simulation: 'This draft is no longer available. It may have timed out.',
  merge: 'This proposal could not be found. It may have already been published.',
  rules: 'The rules configuration could not be loaded.',
  general: 'The requested item could not be found.',
};

/**
 * Maps an API error code + optional context to a human-readable message.
 *
 * Pure function — no side effects.
 */
export function getErrorMessage(code: string, context: ErrorContext = 'general'): string {
  if (code === 'NOT_FOUND') {
    return CONTEXT_NOT_FOUND[context];
  }
  return ERROR_MAP[code] ?? 'An unexpected error occurred. Please try again.';
}
