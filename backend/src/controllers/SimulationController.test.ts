import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { SimulationController } from './SimulationController.js';
import type { ISimulationService } from '../interfaces/ISimulationService.js';

const makeService = (): ISimulationService => ({
  create: vi.fn(),
  heartbeat: vi.fn(),
  commit: vi.fn(),
  listClasses: vi.fn(),
  updateClass: vi.fn(),
  getSuggestions: vi.fn(),
  getConflicts: vi.fn(),
  getMetrics: vi.fn(),
  getScore: vi.fn(),
  previewClassUpdate: vi.fn(),
  getSchedule: vi.fn(),
  delete: vi.fn(),
});

const makeRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('SimulationController.getSchedule()', () => {
  it('returns 200 with the schedule from the service', async () => {
    const service = makeService();
    const schedule = {
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
    };
    (service.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(schedule);
    const controller = new SimulationController(service);
    const req = { params: { id: 'sim-1' } } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getSchedule(req, res, next);

    expect(service.getSchedule).toHaveBeenCalledWith('sim-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(schedule);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes errors to next()', async () => {
    const service = makeService();
    const error = new Error('boom');
    (service.getSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new SimulationController(service);
    const req = { params: { id: 'sim-1' } } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getSchedule(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
