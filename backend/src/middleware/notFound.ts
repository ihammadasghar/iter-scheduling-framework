import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/ApiError.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Cannot ${req.method} ${req.path}`));
}
