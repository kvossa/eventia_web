import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page auth">
      <div class="panel">
        @if (sent()) {
          <h1 class="page-title">Check your inbox</h1>
          <p class="note" data-testid="forgot-password-sent">
            If an account exists for that email, we've sent a password reset link.
          </p>
          @if (devResetUrl(); as url) {
            <div class="dev-reset" data-testid="forgot-password-dev-link">
              <p class="note">Development build — no email is actually sent.</p>
              <a class="btn btn-primary btn-block" href="{{ url }}">Open the password reset link</a>
            </div>
          }
          <a class="btn btn-primary btn-block" routerLink="/auth/login">Back to login</a>
        } @else {
          <h1 class="page-title">Forgot your password?</h1>
          <p class="note">Enter your account email and we'll send you a reset link.</p>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-field">
              <label class="form-label" for="email">Email</label>
              <input id="email" class="field" type="email" formControlName="email" autocomplete="email" />
            </div>
            <button class="btn btn-primary btn-block" type="submit" [disabled]="form.invalid || busy()">
              {{ busy() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
          <p class="swap">
            Remembered it? <a routerLink="/auth/login">Log in</a>
          </p>
        }
      </div>
    </div>
  `,
  styles: `
    .auth { display: flex; justify-content: center; padding-top: 56px; }
    .panel {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      padding: 28px;
    }
    .note { color: var(--color-text-dim); font-size: 0.9rem; margin-bottom: 18px; }
    .swap { margin-top: 18px; font-size: 0.9rem; color: var(--color-text-dim); text-align: center; }
  `,
})
export class ForgotPasswordPage {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  readonly sent = signal(false);
  readonly busy = signal(false);
  readonly devResetUrl = signal<string | null>(null);

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const res = await this.api.forgotPassword({ email: this.form.value.email ?? '' });
      this.devResetUrl.set(res.devResetUrl ?? null);
      this.sent.set(true);
    } catch (err) {
      const api = err as { message?: string };
      this.toast.show('error', api.message ?? 'Could not request a password reset. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}