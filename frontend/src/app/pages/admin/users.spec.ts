import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from './users';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import type { PublicUser } from '../../core/models';

const makeUser = (id: string, role: PublicUser['role'] = 'customer'): PublicUser => ({
  id,
  name: `User ${id}`,
  email: `user-${id}@example.com`,
  phone: null,
  profileImageUrl: null,
  preferredCity: null,
  role,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
});

describe('AdminUsersPage', () => {
  const setup = async (overrides: { users?: PublicUser[]; selfId?: string; roleError?: unknown } = {}) => {
    const users = overrides.users ?? [makeUser('u1'), makeUser('u2', 'admin')];
    const api = {
      adminUsers: vi.fn(async (params: { page?: number } = {}) => ({
        data: users,
        page: params.page ?? 1,
        limit: 20,
        total: users.length,
      })),
      adminUserRole: overrides.roleError
        ? vi.fn().mockRejectedValue(overrides.roleError)
        : vi.fn(async (id: string, role: PublicUser['role']) => ({ ...makeUser(id), role })),
    };
    const auth = { user: signal<{ id: string } | null>({ id: overrides.selfId ?? 'u1' }) };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminUsersPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminUsersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('lists users with their current role', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('[data-testid="users-list"] .row').length).toBe(2);
    expect(root.textContent).toContain('user-u2@example.com');
    expect((root.querySelector('[data-testid="user-role-u2"]') as HTMLSelectElement).value).toBe('admin');
  });

  it('locks the row of the signed-in admin', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect((root.querySelector('[data-testid="user-role-u1"]') as HTMLSelectElement).disabled).toBe(true);
    const save = root.querySelector('[data-testid="user-save-u1"]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.textContent?.trim()).toBe('You');
  });

  it('enables Save only after a role change', async () => {
    const { fixture, api, toast } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const select = root.querySelector('[data-testid="user-role-u2"]') as HTMLSelectElement;
    const save = root.querySelector('[data-testid="user-save-u2"]') as HTMLButtonElement;

    expect(save.disabled).toBe(true);
    select.value = 'customer';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(save.disabled).toBe(false);

    save.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.adminUserRole).toHaveBeenCalledWith('u2', 'customer');
    expect(toast.show).toHaveBeenCalledWith('success', 'User u2 is now customer.');
    expect(save.disabled).toBe(true);
  });

  it('surfaces role update failures', async () => {
    const { fixture, toast } = await setup({ roleError: new Error('role boom') });
    const page = fixture.componentInstance;
    const user = makeUser('u2', 'admin');

    page.setRole('u2', 'customer');
    await page.save(user);

    expect(toast.show).toHaveBeenCalledWith('error', 'role boom');
    expect(page.saving()).toBe(false);
  });

  it('forwards the search term and shows the empty state', async () => {
    const { fixture, api } = await setup();
    const page = fixture.componentInstance as unknown as { query: string; search: () => Promise<void> };
    page.query = '  ada  ';
    api.adminUsers.mockResolvedValueOnce({ data: [], page: 1, limit: 20, total: 0 });

    await page.search();
    fixture.detectChanges();

    expect(api.adminUsers).toHaveBeenLastCalledWith({ q: 'ada', page: 1, limit: 20 });
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="users-empty"]')).toBeTruthy();
  });
});