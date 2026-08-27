export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static notImplemented(message = 'Not yet implemented'): ApiError {
    return new ApiError(501, 'NOT_IMPLEMENTED', message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  // Distinct from a plain conflict() so callers (the frontend) can tell "the
  // published schedule changed since this draft was created" apart from an
  // ordinary 409 and offer a rebase instead of just showing an error.
  static staleBase(message: string): ApiError {
    return new ApiError(409, 'MAIN_SCHEDULE_CHANGED', message);
  }
}
