import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundError } from '../common/app-error.js';
import { Category } from '../entities/category.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
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
    await this.repo.remove(cat);
  }
}