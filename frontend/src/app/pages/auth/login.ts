import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page auth">
      <div class="panel">
        <h1 class="page-title">Log in</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
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
                autocomplete="current-password"
              />
              <button type="button" class="toggle" (click)="showPassword.set(!showPassword())">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Logging in…' : 'Log in' }}
          </button>
          <a class="forgot" routerLink="/auth/forgot-password" data-testid="forgot-password-link">Forgot password?</a>
        </form>
        <p class="swap">
          No account yet? <a routerLink="/auth/register">Create one</a>
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
    .forgot { display: block; margin-top: 12px; font-size: 0.85rem; text-align: center; color: var(--color-primary); text-decoration: none; }
    .swap { margin-top: 18px; font-size: 0.9rem; color: var(--color-text-dim); text-align: center; }
  `,
})
export class LoginPage implements OnInit {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly showPassword = signal(false);
  readonly busy = signal(false);

  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.auth.login(this.form.value.email ?? '', this.form.value.password ?? '');
      await this.cart.sync().catch(() => undefined);
      this.toast.show('success', `Welcome back, ${this.auth.user()?.name ?? ''}!`);
      await this.router.navigate([this.returnUrl()]);
    } catch (err) {
      const api = err as { code?: string; message?: string };
      const message =
        api.code === 'INVALID_CREDENTIALS'
          ? 'Invalid email or password.'
          : api.message ?? 'Could not log in.';
      this.toast.show('error', message);
    } finally {
      this.busy.set(false);
    }
  }

  private returnUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    return raw && raw !== 'auth/login' ? raw : '/';
  }
}