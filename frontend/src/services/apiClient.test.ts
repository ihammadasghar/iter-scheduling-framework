import { describe, it, expect } from 'vitest';
import type { AxiosError } from 'axios';
import { normalizeApiError, type BackendErrorBody } from './apiClient';

// Minimal fake — normalizeApiError only reads .response.status,
// .response.data.error, and .message.
const fakeAxiosError = (
  init: Partial<{
    status: number;
    body: BackendErrorBody;
    message: string;
  }>,
): AxiosError<BackendErrorBody> => {
  const { status, body, message = 'Network Error' } = init;
  return {
    message,
    response: status === undefined ? undefined : { status, data: body ?? {} },
  } as AxiosError<BackendErrorBody>;
};

describe('normalizeApiError', () => {
  it('flattens the real errorHandler.ts envelope ({ error: { code, message } }) into ApiError', () => {
    const err = fakeAxiosError({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Simulation not found or expired' } },
    });

    expect(normalizeApiError(err)).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Simulation not found or expired',
    });
  });

  it('pulls statusCode from the HTTP status, not the response body (the body never carries one)', () => {
    const err = fakeAxiosError({
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'conflict' } },
    });

    expect(normalizeApiError(err).statusCode).toBe(409);
  });

  it('falls back to a network-error shape when there is no response at all', () => {
    const err = fakeAxiosError({ message: 'Network Error' });

    expect(normalizeApiError(err)).toEqual({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Network Error',
    });
  });

  it('falls back gracefully when a response exists but the body is malformed', () => {
    const err = fakeAxiosError({ status: 500, body: {}, message: 'Request failed with status code 500' });

    expect(normalizeApiError(err)).toEqual({
      statusCode: 500,
      code: 'NETWORK_ERROR',
      message: 'Request failed with status code 500',
    });
  });
});
