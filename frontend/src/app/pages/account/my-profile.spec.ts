import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyProfilePage } from './my-profile';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import type { ProfileView } from '../../core/models';

const PROFILE: ProfileView = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'customer',
  createdAt: '2026-01-15T10:00:00.000Z',
  emailNotifications: true,
  smsNotifications: false,
};

describe('MyProfilePage', () => {
  const setup = async (overrides: { me?: unknown; updateProfile?: unknown } = {}) => {
    const api = {
      me: vi.fn().mockResolvedValue(overrides.me ?? PROFILE),
      updateProfile: vi.fn().mockResolvedValue(overrides.updateProfile ?? { ...PROFILE, name: 'Ada L. Lovelace' }),
      changePassword: vi.fn().mockResolvedValue({ success: true }),
      updateNotificationPreferences: vi.fn().mockResolvedValue({ success: true }),
    };
    const user = signal<{ name: string; email: string; role: string } | null>({ name: 'Ada Lovelace', email: 'ada@example.com', role: 'customer' });
    const auth = { user };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [MyProfilePage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MyProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast, user };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('loads and pre-fills the profile', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    expect(page.form.value.name).toBe('Ada Lovelace');
    expect(page.form.value.email).toBe('ada@example.com');
    expect(page.prefsForm.value.emailNotifications).toBe(true);
    expect(page.prefsForm.value.smsNotifications).toBe(false);
    expect(root.textContent).toContain('Member since');
  });

  it('saves profile changes and refreshes the stored user', async () => {
    const { fixture, api, toast, user } = await setup();
    const page = fixture.componentInstance;

    page.form.controls.name.setValue('Ada L. Lovelace');
    await page.save();
    fixture.detectChanges();

    expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Ada L. Lovelace', email: 'ada@example.com' });
    expect(page.saved()).toBe(true);
    expect(toast.show).toHaveBeenCalledWith('success', 'Profile updated.');
    expect(user()?.name).toBe('Ada L. Lovelace');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="profile-saved"]')).toBeTruthy();
  });

  it('changes the password and resets the form', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;

    page.passwordForm.controls.currentPassword.setValue('oldpass1');
    page.passwordForm.controls.newPassword.setValue('newpass12');
    await page.changePassword();

    expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'oldpass1', newPassword: 'newpass12' });
    expect(page.passwordSaved()).toBe(true);
    expect(page.passwordForm.value.currentPassword).toBeNull();
    expect(toast.show).toHaveBeenCalledWith('success', 'Password updated.');
  });

  it('saves notification preferences', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;

    page.prefsForm.controls.smsNotifications.setValue(true);
    await page.savePreferences();

    expect(api.updateNotificationPreferences).toHaveBeenCalledWith({ emailNotifications: true, smsNotifications: true });
    expect(page.prefsSaved()).toBe(true);
    expect(toast.show).toHaveBeenCalledWith('success', 'Notification preferences saved.');
  });

  it('surfaces a load failure as a toast', async () => {
    const { fixture, toast } = await setup({ me: Promise.reject(new Error('boom')) });
    await fixture.whenStable();

    expect(toast.show).toHaveBeenCalledWith('error', 'boom');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});