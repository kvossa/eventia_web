import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './forgot-password';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

const ROUTER_PROVIDERS = [
  { provide: Router, useValue: { navigate: vi.fn() } },
  { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
];

describe('ForgotPasswordPage', () => {
  const setup = async (post: ReturnType<typeof vi.fn>) => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        { provide: ApiService, useValue: { forgotPassword: post } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        ...ROUTER_PROVIDERS,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.email.setValue('buyer@example.com');
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('shows the reset link when the backend returns one in development', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ success: true, devResetUrl: 'http://localhost:4200/auth/reset-password?token=abc' });
    const fixture = await setup(post);

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="forgot-password-dev-link"] a',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/auth/reset-password?token=abc');
  });

  it('keeps the message anonymous when the backend returns no link', async () => {
    const post = vi.fn().mockResolvedValue({ success: true });
    const fixture = await setup(post);

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('we\'ve sent a password reset link');
    expect(fixture.nativeElement.querySelector('[data-testid="forgot-password-dev-link"]')).toBeNull();
  });

  it('surfaces API failures instead of silently re-enabling the button', async () => {
    const post = vi.fn().mockRejectedValue({ code: 'THROTTLED', statusCode: 429, message: 'Too many requests.' });
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        { provide: ApiService, useValue: { forgotPassword: post } },
        { provide: ToastService, useValue: toast },
        ...ROUTER_PROVIDERS,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.email.setValue('buyer@example.com');

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.componentInstance.sent()).toBe(false);
    expect(toast.show).toHaveBeenCalledWith('error', 'Too many requests.');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeTruthy();
  });
});