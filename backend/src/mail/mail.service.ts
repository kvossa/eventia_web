import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { EmailOutboxRecord } from '../entities/email-outbox.entity.js';
import { User } from '../entities/user.entity.js';

export interface OutboxEmail {
  to: string;
  subject: string;
  body: string;
  userId?: string;
}

const DEFAULT_DRAIN_INTERVAL_MS = 15_000;
const DRAIN_BATCH_SIZE = 50;

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(EmailOutboxRecord)
    private readonly outboxRepository: Repository<EmailOutboxRecord>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.intervalMs = Number(config.get('MAIL_DRAIN_INTERVAL_MS') ?? DEFAULT_DRAIN_INTERVAL_MS);
  }

  onModuleInit(): void {
    if (this.intervalMs <= 0) return;
    this.timer = setInterval(() => {
      void this.drain().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Scheduled outbox drain failed: ${reason}`);
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async enqueue(email: OutboxEmail, em?: EntityManager): Promise<boolean> {
    const repository = em ? em.getRepository(EmailOutboxRecord) : this.outboxRepository;
    await repository.save(
      repository.create({ to: email.to, subject: email.subject, body: email.body }),
    );
    return true;
  }

  async enqueueIfOptedIn(email: OutboxEmail, em?: EntityManager): Promise<boolean> {
    if (email.userId) {
      const users = em ? em.getRepository(User) : this.userRepository;
      const user = await users.findOne({
        where: { id: email.userId },
        select: { id: true, emailNotifications: true },
      });
      if (user && !user.emailNotifications) return false;
    }
    return this.enqueue(email, em);
  }

  async drain(limit = DRAIN_BATCH_SIZE): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      const rows = await em
        .createQueryBuilder(EmailOutboxRecord, 'e')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('e.status = :status', { status: 'pending' })
        .orderBy('e.createdAt', 'ASC')
        .limit(limit)
        .getMany();
      if (rows.length === 0) return 0;

      const sentAt = new Date();
      for (const row of rows) {
        this.logger.log(`Outbox delivery: "${row.subject}" to ${row.to}`);
        row.status = 'sent';
        row.sentAt = sentAt;
      }
      await em.getRepository(EmailOutboxRecord).save(rows);
      return rows.length;
    });
  }
}
