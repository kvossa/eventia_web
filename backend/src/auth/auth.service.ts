import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CartService } from '../cart/cart.service.js';
import { AppError } from '../common/app-error.js';
import { parseTtlMs } from '../common/duration.js';
import { RefreshSession } from '../entities/refresh-session.entity.js';
import { User } from '../entities/user.entity.js';
import { MailService } from '../mail/mail.service.js';
import { toPublicUser } from '../users/user.mapper.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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
    private readonly mailService: MailService,
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

  async requestPasswordReset(email: string): Promise<{ success: true }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { success: true };

    const token = randomBytes(48).toString('base64url');
    user.passwordResetTokenHash = this.hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.usersService.save(user);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    await this.mailService.enqueue({
      to: user.email,
      subject: 'Reset your Eventia password',
      body: [
        'Hello,',
        '',
        'You requested a password reset for your Eventia account.',
        `${frontendUrl}/auth/reset-password?token=${token}`,
        '',
        'This link expires in 60 minutes. If you did not request this, you can ignore this email.',
      ].join('\n'),
    });

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    const user = await this.usersService.findByPasswordResetTokenHash(this.hashToken(token));
    if (
      !user ||
      user.passwordResetExpiresAt === null ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired reset token', 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.usersService.save(user);
    await this.revokeAllForUser(user.id);

    await this.mailService.enqueue({
      to: user.email,
      subject: 'Your Eventia password was reset',
      body: ['Hello,', '', 'Your Eventia password has been reset successfully.', 'If you did not do this, please contact support.'].join('\n'),
    });

    return { success: true };
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