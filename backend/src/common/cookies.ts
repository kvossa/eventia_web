import type { Response } from 'express';

export const CART_COOKIE = 'eventia_cart';
export const REFRESH_COOKIE = 'eventia_refresh';

export interface CookieOptions {
  secure: boolean;
  maxAgeMs: number;
}

export const setCartCookie = (res: Response, cartId: string, options: CookieOptions): void => {
  res.cookie(CART_COOKIE, cartId, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: options.secure,
    maxAge: options.maxAgeMs,
  });
};

export const setRefreshCookie = (res: Response, token: string, options: CookieOptions): void => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: options.secure,
    maxAge: options.maxAgeMs,
  });
};

export const clearRefreshCookie = (res: Response, options: Pick<CookieOptions, 'secure'>): void => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: options.secure,
  });
};