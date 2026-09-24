import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';

function matchValidator(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  if (!group) return null;
  return group.get('newPassword')?.value === control.value ? null : { match: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page auth">
      <div class="panel">
        @if (done()) {
          <h1 class="page-title">Password updated</h1>
          <p class="note" data-testid="reset-password-done">Your password has been reset successfully.</p>
          <a class="btn btn-primary btn-block" routerLink="/auth/login">Log in</a>
        } @else {
          <h1 class="page-title">Set a new password</h1>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-field">
              <label class="form-label" for="newPassword">New password</label>
              <div class="pw">
                <input
                  id="newPassword"
                  class="field"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="newPassword"
                  autocomplete="new-password"
                />
                <button type="button" class="toggle" (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>
            <div class="form-field">
              <label class="form-label" for="confirm">Confirm password</label>
              <input
                id="confirm"
                class="field"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
            </div>
            <button class="btn btn-primary btn-block" type="submit" [disabled]="form.invalid || busy()">
              {{ busy() ? 'Resetting…' : 'Reset password' }}
            </button>
          </form>
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
    .pw { position: relative; }
    .pw .field { padding-right: 64px; }
    .toggle {
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: var(--color-text-dim); cursor: pointer;
      font-size: 0.8rem; font-weight: 600;
    }
    .note { color: var(--color-text-dim); font-size: 0.9rem; margin-bottom: 18px; }
  `,
})
export class ResetPasswordPage {
  readonly form = new FormGroup({
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, matchValidator] }),
  });

  readonly showPassword = signal(false);
  readonly done = signal(false);
  readonly busy = signal(false);

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.busy.set(true);
    try {
      await this.api.resetPassword({ token, newPassword: this.form.value.newPassword ?? '' });
      this.done.set(true);
    } catch (err) {
      const api = err as { message?: string };
      this.toast.show('error', api.message ?? 'This reset link is invalid or has expired.');
    } finally {
      this.busy.set(false);
    }
  }
}