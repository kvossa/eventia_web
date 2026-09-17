import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page auth">
      <div class="panel">
        <h1 class="page-title">Create your account</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-field">
            <label class="form-label" for="name">Full name</label>
            <input id="name" class="field" formControlName="name" autocomplete="name" />
          </div>
          <div class="form-field">
            <label class="form-label" for="email">Email</label>
            <input id="email" class="field" type="email" formControlName="email" autocomplete="email" />
          </div>
          <div class="form-field">
            <label class="form-label" for="password">Password</label>
            <div class="pw">
              <input
                id="password"
                class="field"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
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
            {{ busy() ? 'Creating…' : 'Create account' }}
          </button>
        </form>
        <p class="swap">
          Already registered? <a routerLink="/auth/login">Log in</a>
        </p>
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
    .swap { margin-top: 18px; font-size: 0.9rem; color: var(--color-text-dim); text-align: center; }
  `,
})
export class RegisterPage {
  readonly form = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: (g: AbstractControl) => this.matchingPassword(g) },
  );

  readonly showPassword = signal(false);
  readonly busy = signal(false);

  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.auth.register(
        this.form.value.name ?? '',
        this.form.value.email ?? '',
        this.form.value.password ?? '',
      );
      await this.cart.sync().catch(() => undefined);
      this.toast.show('success', `Welcome, ${this.auth.user()?.name ?? ''}!`);
      await this.router.navigate(['/']);
    } catch (err) {
      const api = err as { code?: string; message?: string };
      const message =
        api.code === 'EMAIL_TAKEN'
          ? 'An account with this email already exists.'
          : api.message ?? 'Could not create your account.';
      this.toast.show('error', message);
    } finally {
      this.busy.set(false);
    }
  }

  private matchingPassword(group: AbstractControl): { mismatch: true } | null {
    const g = group as { value: { password?: string; confirmPassword?: string } };
    if (g.value.password && g.value.confirmPassword && g.value.password !== g.value.confirmPassword) {
      return { mismatch: true };
    }
    return null;
  }
}