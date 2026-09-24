import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthUserPayload } from '../common/decorators/current-user.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CART_COOKIE, clearRefreshCookie, REFRESH_COOKIE, setCartCookie, setRefreshCookie } from '../common/cookies.js';
import { parseTtlMs } from '../common/duration.js';
import { CART_TTL_MS } from '../cart/cart.service.js';
import { AuthResult, AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;
  private readonly refreshCookieMs: number;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
    this.refreshCookieMs = parseTtlMs(config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d');
  }

  @Post('register')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new customer account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.readCartId(req));
    return this.authResponse(res, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.readCartId(req));
    return this.authResponse(res, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using the refresh cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshToken(req);
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const result = await this.authService.refresh(token);
    return this.authResponse(res, result);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password and revoke all refresh sessions' })
  async changePassword(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
    clearRefreshCookie(res, { secure: this.cookieSecure });
    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token and log out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readRefreshToken(req);
    await this.authService.logout(token);
    clearRefreshCookie(res, { secure: this.cookieSecure });
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset the password with a one-time token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  private readCartId(req: Request): string | null {
    const id = (req.cookies as Record<string, string | undefined> | undefined)?.[CART_COOKIE];
    return typeof id === 'string' && id ? id : null;
  }

  private readRefreshToken(req: Request): string | undefined {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
    return typeof token === 'string' && token ? token : undefined;
  }

  private authResponse(res: Response, result: AuthResult): { accessToken: string; user: AuthResult['user'] } {
    if (result.cartId) {
      setCartCookie(res, result.cartId, {
        secure: this.cookieSecure,
        maxAgeMs: CART_TTL_MS,
      });
    }
    if (result.newRefreshToken) {
      setRefreshCookie(res, result.newRefreshToken, {
        secure: this.cookieSecure,
        maxAgeMs: this.refreshCookieMs,
      });
    }
    return { accessToken: result.accessToken, user: result.user };
  }
}