import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError } from '../common/app-error.js';
import { User } from '../entities/user.entity.js';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: User['role'];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
    }

    const user = this.usersRepository.create({
      name: input.name,
      email,
      passwordHash: input.passwordHash,
      role: input.role ?? 'customer',
    });
    return this.usersRepository.save(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new ConflictError('USER_NOT_FOUND', 'User not found');
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      const taken = await this.usersRepository.findOne({ where: { email } });
      if (taken && taken.id !== user.id) {
        throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
      }
      user.email = email;
    }
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.preferredCity !== undefined) user.preferredCity = dto.preferredCity;
    if (dto.profileImageUrl !== undefined) user.profileImageUrl = dto.profileImageUrl;

    return this.usersRepository.save(user);
  }

  async updateNotificationPreferences(
    id: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new ConflictError('USER_NOT_FOUND', 'User not found');
    }

    if (dto.emailNotifications !== undefined) user.emailNotifications = dto.emailNotifications;
    if (dto.smsNotifications !== undefined) user.smsNotifications = dto.smsNotifications;

    return this.usersRepository.save(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}