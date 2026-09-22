import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CartService } from '../cart/cart.service.js';
import { parseTtlMs } from '../common/duration.js';
import { RefreshSession } from '../entities/refresh-session.entity.js';
import { User } from '../entities/user.entity.js';
import { toPublicUser } from '../users/user.mapper.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface AuthResult {
  accessToken: string;
  user: ReturnType<typeof toPublicUser>;
  newRefreshToken?: string;
  cartId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshSession)
    private readonly sessionsRepository: Repository<RefreshSession>,
    private readonly usersService: UsersService,
    private readonly cartService: CartService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, cartId: string | null): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({ ...dto, passwordHash });
    const cart = await this.cartService.mergeGuestCart(cartId, user.id);
    return { cartId: cart.id, ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginDto, cartId: string | null): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const cart = await this.cartService.mergeGuestCart(cartId, user.id);
    return { cartId: cart.id, ...(await this.issueTokens(user)) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const session = await this.sessionsRepository.findOne({
      where: { tokenHash: this.hashToken(refreshToken) },
      relations: { user: true },
    });

    const invalid =
      !session ||
      !session.user ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() < Date.now();
    if (invalid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    session.revokedAt = new Date();
    await this.sessionsRepository.save(session);

    return this.issueTokens(session.user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.sessionsRepository.update(
      { tokenHash: this.hashToken(refreshToken) },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessionsRepository.update({ userId }, { revokedAt: new Date() });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.save(user);
    await this.revokeAllForUser(userId);
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync(
      { email: user.email, role: user.role },
      { subject: user.id },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const session = this.sessionsRepository.create({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshCookieMs()),
      revokedAt: null,
    });
    await this.sessionsRepository.save(session);

    return {
      accessToken,
      user: toPublicUser(user),
      newRefreshToken: refreshToken,
    };
  }

  private refreshCookieMs(): number {
    return parseTtlMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}