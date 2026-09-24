import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

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

  private readonly api = inject(ApiService);

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.api.forgotPassword({ email: this.form.value.email ?? '' });
      this.sent.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}