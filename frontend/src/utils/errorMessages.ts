// Pure function mapping API error codes/contexts to plain-language messages
// via react-intl. Never exposes HTTP status codes, technical error codes, or
// stack traces to users.

import { defineMessages, type IntlShape } from 'react-intl';

export type ErrorContext = 'simulation' | 'merge' | 'rules' | 'general';

const errorMessages = defineMessages({
  INTERNAL_SERVER_ERROR: {
    id: 'errorMessages.internalServerError',
    defaultMessage: 'Something went wrong on our end. Please try again.',
  },
  CONFLICT: {
    id: 'errorMessages.conflict',
    defaultMessage: 'This proposal cannot be published yet — it still has scheduling conflicts.',
  },
  NOT_IMPLEMENTED: {
    id: 'errorMessages.notImplemented',
    defaultMessage: 'This feature is not available yet. Please contact your IT department.',
  },
  fallback: {
    id: 'errorMessages.fallback',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
});

const contextNotFoundMessages = defineMessages({
  simulation: {
    id: 'errorMessages.contextNotFound.simulation',
    defaultMessage: 'This draft is no longer available. It may have timed out.',
  },
  merge: {
    id: 'errorMessages.contextNotFound.merge',
    defaultMessage: 'This proposal could not be found. It may have already been published.',
  },
  rules: {
    id: 'errorMessages.contextNotFound.rules',
    defaultMessage: 'The rules configuration could not be loaded.',
  },
  general: {
    id: 'errorMessages.contextNotFound.general',
    defaultMessage: 'The requested item could not be found.',
  },
});

/**
 * Maps an API error code + optional context to a human-readable message.
 *
 * Pure function — no side effects, beyond reading from the `intl` passed in.
 */
export function getErrorMessage(intl: IntlShape, code: string, context: ErrorContext = 'general'): string {
  if (code === 'NOT_FOUND') {
    return intl.formatMessage(contextNotFoundMessages[context]);
  }
  return intl.formatMessage(code in errorMessages ? errorMessages[code as keyof typeof errorMessages] : errorMessages.fallback);
}
