import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { UserUpdateInput, PasswordChangeInput, ProfileView, PasswordChangeResponse } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-my-profile',
  imports: [ReactiveFormsModule, RouterLink, Loading],
  template: `
    <div class="page narrow">
      <h1 class="page-title">My profile</h1>

      @if (loading()) {
        <app-loading />
      } @else {
        <form class="card card-pad" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <h2>Account details</h2>

          <label class="field-label" for="profileName">Name</label>
          <input
            id="profileName"
            class="field"
            formControlName="name"
            autocomplete="name"
            data-testid="profile-name"
          />

          <label class="field-label" for="profileEmail">Email</label>
          <input
            id="profileEmail"
            class="field"
            formControlName="email"
            type="email"
            autocomplete="email"
            data-testid="profile-email"
          />

          <p class="sub">Member since {{ formatDate() }}</p>

          <div class="actions">
            <button
              class="btn btn-primary"
              type="submit"
              [disabled]="form.invalid || saving()"
              data-testid="save-profile"
            >{{ saving() ? 'Saving…' : 'Save changes' }}</button>
          </div>

          @if (saved()) {
            <p class="ok" data-testid="profile-saved">Profile updated.</p>
          }
        </form>

        <form class="card card-pad" [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
          <h2>Change password</h2>

          <label class="field-label" for="currentPassword">Current password</label>
          <input
            id="currentPassword"
            class="field"
            formControlName="currentPassword"
            type="password"
            autocomplete="current-password"
            data-testid="current-password"
          />

          <label class="field-label" for="newPassword">New password</label>
          <input
            id="newPassword"
            class="field"
            formControlName="newPassword"
            type="password"
            autocomplete="new-password"
            data-testid="new-password"
          />

          <div class="actions">
            <button
              class="btn btn-primary"
              type="submit"
              [disabled]="passwordForm.invalid || changing()"
              data-testid="change-password"
            >{{ changing() ? 'Changing…' : 'Change password' }}</button>
          </div>

          @if (passwordSaved()) {
            <p class="ok" data-testid="password-saved">Password updated.</p>
          }
        </form>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 520px; }
    form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .field-label { font-size: 0.88rem; color: var(--color-text-dim); }
    .sub { color: var(--color-text-dim); font-size: 0.85rem; margin: 2px 0 10px; }
    .actions { margin-top: 8px; }
    .ok {
      padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.9rem;
      background: var(--color-success-bg, rgba(46, 160, 67, 0.12));
      color: var(--color-success, #3fb950);
    }
  `,
})
export class MyProfilePage implements OnInit {
  readonly form = new FormBuilder().group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
  });
  readonly passwordForm = new FormBuilder().group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly changing = signal(false);
  readonly saved = signal(false);
  readonly passwordSaved = signal(false);
  readonly createdAt = signal('');

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    try {
      const me = await this.api.me<ProfileView>();
      this.form.patchValue({ name: me.name, email: me.email });
      this.createdAt.set(me.createdAt);
    } catch (err) {
      this.toast.show('error', (err as { message?: string }).message ?? 'Could not load your profile.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saved.set(false);
    try {
      const body: UserUpdateInput = {
        name: this.form.value.name ?? undefined,
        email: this.form.value.email ?? undefined,
      };
      const updated = await this.api.updateProfile<ProfileView>(body);
      this.auth.user.update((u) => (u ? { ...u, name: updated.name, email: updated.email } : u));
      this.saved.set(true);
      this.toast.show('success', 'Profile updated.');
    } catch (err) {
      this.toast.show('error', (err as { message?: string }).message ?? 'Could not update your profile.');
    } finally {
      this.saving.set(false);
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;
    this.changing.set(true);
    this.passwordSaved.set(false);
    try {
      const body: PasswordChangeInput = {
        currentPassword: this.passwordForm.value.currentPassword ?? '',
        newPassword: this.passwordForm.value.newPassword ?? '',
      };
      await this.api.changePassword(body);
      this.passwordForm.reset();
      this.passwordSaved.set(true);
      this.toast.show('success', 'Password updated.');
    } catch (err) {
      this.toast.show('error', (err as { message?: string }).message ?? 'Could not change your password.');
    } finally {
      this.changing.set(false);
    }
  }

  formatDate(): string {
    const d = new Date(this.createdAt());
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }
}
