import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundError } from '../common/app-error.js';
import { Organizer } from '../entities/organizer.entity.js';

@Injectable()
export class OrganizersService {
  constructor(
    @InjectRepository(Organizer)
    private readonly repo: Repository<Organizer>,
  ) {}

  findAll(): Promise<Organizer[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Organizer> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundError('ORGANIZER_NOT_FOUND', 'Organizer not found');
    return org;
  }

  create(data: { name: string; slug: string; description?: string | null; websiteUrl?: string | null; logoUrl?: string | null }): Promise<Organizer> {
    const org = this.repo.create(data);
    return this.repo.save(org);
  }

  async update(id: string, data: Partial<{ name: string; slug: string; description: string | null; websiteUrl: string | null; logoUrl: string | null }>): Promise<Organizer> {
    const org = await this.findOne(id);
    Object.assign(org, data);
    return this.repo.save(org);
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id);
    await this.repo.softRemove(org);
  }
}