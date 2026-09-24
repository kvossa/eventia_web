import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminNav } from '../../components/admin-nav';
import { Loading } from '../../components/loading';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PublicUser } from '../../core/models';
import type { UserRole } from '@eventia/shared';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, AdminNav, Loading],
  template: `
    <div class="page">
      <h1 class="page-title">Users</h1>

      <app-admin-nav />

      <form class="filters" (ngSubmit)="search()" data-testid="users-search-form">
        <div class="form-field search">
          <input
            class="field"
            name="q"
            [(ngModel)]="query"
            placeholder="Search by name or email"
            data-testid="users-search"
          />
        </div>
        <div class="form-field">
          <button class="btn btn-primary" type="submit">Search</button>
        </div>
      </form>

      @if (loading()) {
        <app-loading />
      } @else if (users().length === 0) {
        <div class="card card-pad" data-testid="users-empty">
          <p>No users found.</p>
        </div>
      } @else {
        <div class="card card-pad" data-testid="users-list">
          <div class="head">
            <span>Name</span>
            <span>Email</span>
            <span>Signed up</span>
            <span>Role</span>
            <span></span>
          </div>
          @for (u of users(); track u.id) {
            <div class="row" [attr.data-testid]="'user-' + u.id">
              <span class="name">{{ u.name }}</span>
              <span class="email">{{ u.email }}</span>
              <span class="date">{{ signupDate(u.createdAt) }}</span>
              <select
                class="field role"
                [ngModel]="pendingRole(u.id) ?? u.role"
                (ngModelChange)="setRole(u.id, $event)"
                [disabled]="isSelf(u) || saving()"
                [attr.data-testid]="'user-role-' + u.id"
              >
                <option value="customer">customer</option>
                <option value="admin">admin</option>
              </select>
              <button
                class="btn btn-sm btn-primary"
                type="button"
                [disabled]="isSelf(u) || !changed(u) || saving()"
                (click)="save(u)"
                [attr.data-testid]="'user-save-' + u.id"
              >{{ isSelf(u) ? 'You' : 'Save' }}</button>
            </div>
          }
        </div>

        <div class="pager">
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() <= 1"
            (click)="load(page() - 1)"
            data-testid="users-prev"
          >Previous</button>
          <span class="page-num">{{ page() }} of {{ totalPages() }}</span>
          <button
            class="btn btn-ghost"
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="load(page() + 1)"
            data-testid="users-next"
          >Next</button>
        </div>
      }
    </div>
  `,
  styles: `
    .filters { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .search { flex: 1; min-width: 260px; }
    .head { display: grid; grid-template-columns: 1.2fr 1.5fr 1fr 1fr 120px; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border); color: var(--color-text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .row { display: grid; grid-template-columns: 1.2fr 1.5fr 1fr 1fr 120px; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
    .row:last-child { border-bottom: none; }
    .name { font-weight: 600; }
    .email, .date { color: var(--color-text-dim); font-size: 0.9rem; }
    .role { width: 100%; }
    .pager { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
    .page-num { color: var(--color-text-dim); font-size: 0.9rem; }
    @media (max-width: 760px) {
      .head { display: none; }
      .row { grid-template-columns: 1fr; }
    }
  `,
})
export class AdminUsersPage {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly users = signal<PublicUser[]>([]);
  readonly page = signal(1);
  readonly limit = 20;

  protected query = '';
  private readonly pendingRoles = new Map<string, UserRole>();
  private total = 0;

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  async ngOnInit(): Promise<void> {
    await this.load(1);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  isSelf(u: PublicUser): boolean {
    return u.id === this.auth.user()?.id;
  }

  pendingRole(id: string): UserRole | undefined {
    return this.pendingRoles.get(id);
  }

  changed(u: PublicUser): boolean {
    const pending = this.pendingRoles.get(u.id);
    return pending !== undefined && pending !== u.role;
  }

  setRole(id: string, role: UserRole): void {
    this.pendingRoles.set(id, role);
  }

  async save(u: PublicUser): Promise<void> {
    const role = this.pendingRoles.get(u.id);
    if (!role || role === u.role) return;
    this.saving.set(true);
    try {
      const updated = await this.api.adminUserRole(u.id, role);
      this.users.update((list) => list.map((x) => (x.id === updated.id ? { ...x, role: updated.role } : x)));
      this.pendingRoles.delete(u.id);
      this.toast.show('success', `${updated.name} is now ${updated.role}.`);
    } catch (err) {
      this.toast.show('error', (err as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async search(): Promise<void> {
    await this.load(1);
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    try {
      const q = this.query.trim();
      const res = await this.api.adminUsers({ q, page, limit: this.limit });
      this.users.set(res.data);
      this.total = res.total;
      this.page.set(res.page);
    } catch (err) {
      this.users.set([]);
      this.toast.show('error', (err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  signupDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
}