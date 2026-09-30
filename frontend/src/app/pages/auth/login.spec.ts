import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';

describe('LoginPage', () => {
  const setup = async (overrides: { returnUrl?: string; error?: unknown; authenticated?: boolean } = {}) => {
    const auth = {
      isAuthenticated: () => overrides.authenticated ?? false,
      login: overrides.error
        ? vi.fn().mockRejectedValue(overrides.error)
        : vi.fn().mockResolvedValue({ accessToken: 't' }),
      user: () => ({ name: 'Ada Lovelace' }),
    };
    const cart = { sync: vi.fn().mockResolvedValue(undefined) };
    const toast = { show: vi.fn() };
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CartService, useValue: cart },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(overrides.returnUrl ? { returnUrl: overrides.returnUrl } : {}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    return { fixture, auth, cart, toast, router };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('disables submit while the form is invalid', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const submit = root.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('logs in and redirects to the returnUrl', async () => {
    const { fixture, auth, cart, toast, router } = await setup({ returnUrl: 'checkout' });
    const page = fixture.componentInstance;

    page.form.controls.email.setValue('ada@example.com');
    page.form.controls.password.setValue('secret123');
    await page.submit();

    expect(auth.login).toHaveBeenCalledWith('ada@example.com', 'secret123');
    expect(cart.sync).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['checkout']);
    expect(toast.show).toHaveBeenCalledWith('success', 'Welcome back, Ada Lovelace!');
    expect(page.busy()).toBe(false);
  });

  it('redirects home when no returnUrl is present', async () => {
    const { fixture, router } = await setup();
    const page = fixture.componentInstance;

    page.form.controls.email.setValue('ada@example.com');
    page.form.controls.password.setValue('secret123');
    await page.submit();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('maps invalid credentials to a friendly error', async () => {
    const { fixture, toast, router } = await setup({
      error: { code: 'INVALID_CREDENTIALS', statusCode: 401, message: 'Invalid credentials.' },
    });
    const page = fixture.componentInstance;

    page.form.controls.email.setValue('ada@example.com');
    page.form.controls.password.setValue('wrong');
    await page.submit();

    expect(toast.show).toHaveBeenCalledWith('error', 'Invalid email or password.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('#password') as HTMLInputElement;
    const toggle = root.querySelector('.toggle') as HTMLButtonElement;

    expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });
});