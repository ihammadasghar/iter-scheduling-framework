import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ScheduleController } from './ScheduleController.js';
import type { IScheduleService } from '../interfaces/IScheduleService.js';

const makeService = (): IScheduleService => ({
  listClasses: vi.fn(),
  getRoster: vi.fn(),
});

const makeRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('ScheduleController.listClasses()', () => {
  it('parses page/limit from the query string and returns 200 with the result', async () => {
    const service = makeService();
    const result = { data: [], total: 0, page: 2, limit: 10 };
    (service.listClasses as ReturnType<typeof vi.fn>).mockResolvedValue(result);
    const controller = new ScheduleController(service);
    const req = { query: { page: '2', limit: '10' } } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.listClasses(req, res, next);

    expect(service.listClasses).toHaveBeenCalledWith(2, 10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults to page 1, limit 20 when the query string is empty', async () => {
    const service = makeService();
    (service.listClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    const controller = new ScheduleController(service);
    const req = { query: {} } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.listClasses(req, res, next);

    expect(service.listClasses).toHaveBeenCalledWith(1, 20);
  });

  it('passes errors to next()', async () => {
    const service = makeService();
    const error = new Error('boom');
    (service.listClasses as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new ScheduleController(service);
    const req = { query: {} } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.listClasses(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('ScheduleController.getRoster()', () => {
  it('returns 200 with the roster from the service', async () => {
    const service = makeService();
    const roster = { metadata: {}, timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [] };
    (service.getRoster as ReturnType<typeof vi.fn>).mockResolvedValue(roster);
    const controller = new ScheduleController(service);
    const req = {} as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getRoster(req, res, next);

    expect(service.getRoster).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(roster);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes errors to next()', async () => {
    const service = makeService();
    const error = new Error('boom');
    (service.getRoster as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new ScheduleController(service);
    const req = {} as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getRoster(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
