import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError, NotFoundError } from '../common/app-error.js';
import { Category } from '../entities/category.entity.js';
import { Event } from '../entities/event.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundError('CATEGORY_NOT_FOUND', 'Category not found');
    return cat;
  }

  create(name: string, slug: string, description?: string): Promise<Category> {
    const cat = this.repo.create({ name, slug, description: description ?? null });
    return this.repo.save(cat);
  }

  async update(id: string, data: { name?: string; slug?: string; description?: string | null }): Promise<Category> {
    const cat = await this.findOne(id);
    Object.assign(cat, data);
    return this.repo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.findOne(id);
    const used = await this.eventsRepo.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new ConflictError('CATEGORY_IN_USE', 'Cannot delete a category that still has events');
    }
    await this.repo.remove(cat);
  }
}