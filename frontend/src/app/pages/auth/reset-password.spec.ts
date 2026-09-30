import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './reset-password';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

describe('ResetPasswordPage password confirmation', () => {
  const setup = async (): Promise<{ fixture: ReturnType<typeof TestBed.createComponent<ResetPasswordPage>>; reset: ReturnType<typeof vi.fn> }> => {
    const reset = vi.fn().mockResolvedValue({ success: true });
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        { provide: ApiService, useValue: { resetPassword: reset } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'tk' }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    return { fixture, reset };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('accepts matching passwords', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.form.setValue({ newPassword: 'password123', confirmPassword: 'password123' });

    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(fixture.componentInstance.form.errors).toBeNull();
  });

  it('becomes invalid when the password is edited after confirmation', async () => {
    const { fixture, reset } = await setup();
    fixture.componentInstance.form.setValue({ newPassword: 'password123', confirmPassword: 'password123' });
    expect(fixture.componentInstance.form.valid).toBe(true);

    fixture.componentInstance.form.controls.newPassword.setValue('otherpass456');
    fixture.detectChanges();

    expect(fixture.componentInstance.form.errors?.['match']).toBe(true);
    expect(fixture.componentInstance.form.valid).toBe(false);

    await fixture.componentInstance.submit();
    expect(reset).not.toHaveBeenCalled();
  });

  it('renders the mismatch message once the field is touched', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.form.setValue({ newPassword: 'password123', confirmPassword: 'password123' });
    fixture.componentInstance.form.controls.newPassword.setValue('otherpass456');
    fixture.componentInstance.form.controls.confirmPassword.markAsTouched();
    fixture.detectChanges();

    const error = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="reset-password-match-error"]',
    );
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain('Passwords do not match.');
  });
});