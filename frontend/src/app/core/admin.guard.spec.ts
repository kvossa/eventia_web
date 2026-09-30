import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import type { User } from './models';

const admin: User = { id: 'u1', name: 'Root', email: 'root@eventia.local', role: 'admin' };
const customer: User = { id: 'u2', name: 'Ann', email: 'ann@eventia.local', role: 'customer' };

class FakeAuth {
  readonly user = signal<User | null>(null);
  readonly isAuthenticated = signal(false);
  readonly initialize = vi.fn(async () => {
    this.isAuthenticated.set(true);
    this.user.set(admin);
  });
}

const snapshot = { routeConfig: { path: 'admin/orders' } } as unknown as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

describe('adminGuard', () => {
  let auth: FakeAuth;
  let createUrlTree: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth = new FakeAuth();
    createUrlTree = vi.fn((commands: unknown[], extras?: unknown) => ({ commands, extras }) as unknown as UrlTree);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
  });

  const run = (): ReturnType<typeof adminGuard> =>
    TestBed.runInInjectionContext(
      () => adminGuard(snapshot, state),
    ) as ReturnType<typeof adminGuard>;

  it('admits an admin whose session is only restored by the refresh cookie', async () => {
    expect(auth.user()).toBeNull();

    await expect(Promise.resolve(run())).resolves.toBe(true);
    expect(auth.initialize).toHaveBeenCalledTimes(1);
  });

  it('does not re-initialize when the user is already known', async () => {
    auth.user.set(admin);
    auth.isAuthenticated.set(true);

    await expect(Promise.resolve(run())).resolves.toBe(true);
    expect(auth.initialize).not.toHaveBeenCalled();
  });

  it('sends a dead session to the login page with a return url', async () => {
    auth.initialize.mockImplementation(async () => {
      auth.isAuthenticated.set(false);
      auth.user.set(null);
    });

    const result = await Promise.resolve(run());

    expect(result).not.toBe(true);
    expect(createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: 'admin/orders' },
    });
  });

  it('keeps a signed-in customer out of the admin area', async () => {
    auth.initialize.mockImplementation(async () => {
      auth.isAuthenticated.set(true);
      auth.user.set(customer);
    });

    const result = await Promise.resolve(run());

    expect(result).not.toBe(true);
    expect(createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('still bounces a customer who is already known without hitting the network', async () => {
    auth.user.set(customer);
    auth.isAuthenticated.set(true);

    const result = await Promise.resolve(run());

    expect(createUrlTree).toHaveBeenCalledWith(['/']);
  });
});