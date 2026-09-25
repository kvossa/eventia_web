import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { EmailOutboxRecord } from '../entities/email-outbox.entity.js';
import { User } from '../entities/user.entity.js';
import { MailService } from './mail.service.js';

interface Harness {
  service: MailService;
  outboxSave: ReturnType<typeof vi.fn>;
  outboxRepository: Repository<EmailOutboxRecord>;
  userRepository: Repository<User>;
}

function makeService(interval: string | undefined, optedIn = true): Harness {
  const outboxSave = vi.fn(async (data: unknown) => data);
  const outboxRepository = {
    create: (data: Partial<EmailOutboxRecord>) => data,
    save: outboxSave,
  } as unknown as Repository<EmailOutboxRecord>;

  const userRepository = {
    findOne: vi.fn(async () => ({ id: 'user-1', emailNotifications: optedIn })),
  } as unknown as Repository<User>;

  const dataSource = {
    transaction: vi.fn(async () => {
      throw new Error('transaction should not be used in this test');
    }),
  } as unknown as DataSource;

  const config = {
    get: (key: string) => (key === 'MAIL_DRAIN_INTERVAL_MS' ? interval : undefined),
  } as unknown as ConfigService;

  return {
    service: new MailService(outboxRepository, userRepository, dataSource, config),
    outboxSave,
    outboxRepository,
    userRepository,
  };
}

function makeEm(harness: Harness): EntityManager {
  return {
    getRepository: (entity: unknown) => (entity === User ? harness.userRepository : harness.outboxRepository),
  } as unknown as EntityManager;
}

describe('MailService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enqueues unconditionally without consulting preferences', async () => {
    const harness = makeService('0', false);

    await expect(
      harness.service.enqueue({ to: 'a@b.c', subject: 'Reset', body: 'body' }, makeEm(harness)),
    ).resolves.toBe(true);
    expect(harness.outboxSave).toHaveBeenCalledTimes(1);
  });

  it('skips optional mail when the user opted out', async () => {
    const harness = makeService('0', false);

    await expect(
      harness.service.enqueueIfOptedIn(
        { to: 'a@b.c', subject: 'Your tickets', body: 'b', userId: 'user-1' },
        makeEm(harness),
      ),
    ).resolves.toBe(false);
    expect(harness.outboxSave).not.toHaveBeenCalled();
  });

  it('enqueues optional mail when the user opted in', async () => {
    const harness = makeService('0', true);

    await expect(
      harness.service.enqueueIfOptedIn(
        { to: 'a@b.c', subject: 'Your tickets', body: 'b', userId: 'user-1' },
        makeEm(harness),
      ),
    ).resolves.toBe(true);
    expect(harness.outboxSave).toHaveBeenCalledTimes(1);
  });

  it('enqueues optional mail without a user id and skips the lookup', async () => {
    const harness = makeService('0', false);

    await expect(
      harness.service.enqueueIfOptedIn({ to: 'a@b.c', subject: 'Your tickets', body: 'b' }, makeEm(harness)),
    ).resolves.toBe(true);
    expect(harness.userRepository.findOne).not.toHaveBeenCalled();
    expect(harness.outboxSave).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a drain when the interval is disabled', () => {
    vi.useFakeTimers();
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    makeService('0').service.onModuleInit();
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('schedules a periodic drain and clears it on shutdown', () => {
    vi.useFakeTimers();
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const clearInterval = vi.spyOn(globalThis, 'clearInterval');
    const { service } = makeService('5000');

    service.onModuleInit();
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(setInterval.mock.calls[0][1]).toBe(5000);

    service.onModuleDestroy();
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });

  it('defaults the drain interval to 15 seconds', () => {
    vi.useFakeTimers();
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    makeService(undefined).service.onModuleInit();
    expect(setInterval.mock.calls[0][1]).toBe(15_000);
  });
});
