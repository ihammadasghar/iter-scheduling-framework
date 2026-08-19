import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleService } from './ScheduleService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { RawClass } from '../types/scheduleJson.js';

const makeClass = (id: string): RawClass => ({
  id,
  courseId: 'CRS_BIO101',
  title: `Class ${id}`,
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
});

const scheduleJsonWith = (classCount: number): string =>
  JSON.stringify({
    metadata: {},
    timeSlots: [],
    rooms: [],
    professors: [],
    studentGroups: [],
    courses: [],
    classes: Array.from({ length: classCount }, (_, i) => makeClass(`CLS_${i + 1}`)),
  });

const makeGitHub = (scheduleJson = scheduleJsonWith(3)): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(scheduleJson),
  readFileWithSha: vi.fn().mockResolvedValue({ content: scheduleJson, sha: 'mock-sha' }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('42'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  closePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue(''),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
  getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
  setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
});

describe('ScheduleService.listClasses()', () => {
  let github: IGitHubService;
  let service: ScheduleService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ScheduleService(github);
  });

  it('reads schedule.json from the main branch', async () => {
    await service.listClasses(1, 20);

    expect(github.readFile).toHaveBeenCalledWith('main', 'schedule.json');
  });

  it('defaults to page 1, limit 20 when not finite/positive', async () => {
    const result = await service.listClasses(NaN, NaN);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('returns all classes when they fit on one page', async () => {
    const result = await service.listClasses(1, 20);

    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('paginates correctly across multiple pages', async () => {
    github = makeGitHub(scheduleJsonWith(5));
    service = new ScheduleService(github);

    const page1 = await service.listClasses(1, 2);
    expect(page1.data.map((c) => c.id)).toEqual(['CLS_1', 'CLS_2']);
    expect(page1.total).toBe(5);

    const page2 = await service.listClasses(2, 2);
    expect(page2.data.map((c) => c.id)).toEqual(['CLS_3', 'CLS_4']);

    const page3 = await service.listClasses(3, 2);
    expect(page3.data.map((c) => c.id)).toEqual(['CLS_5']);
  });

  it('clamps limit to MAX_LIMIT (500)', async () => {
    const result = await service.listClasses(1, 10_000);

    expect(result.limit).toBe(500);
  });

  it('returns an empty page when the schedule has no classes', async () => {
    github = makeGitHub(scheduleJsonWith(0));
    service = new ScheduleService(github);

    const result = await service.listClasses(1, 20);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('never creates or deletes a branch — this is a pure read', async () => {
    await service.listClasses(1, 20);

    expect(github.createBranch).not.toHaveBeenCalled();
    expect(github.deleteBranch).not.toHaveBeenCalled();
  });

  it('propagates a typed 400 when schedule.json is malformed', async () => {
    github = makeGitHub();
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('not json');
    service = new ScheduleService(github);

    await expect(service.listClasses(1, 20)).rejects.toMatchObject({ statusCode: 400 });
  });
});
