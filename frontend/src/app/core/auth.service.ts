import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'eventia_access_token';

function readToken(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode / tests)
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(readToken());
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private readonly api: ApiService) {}

  async initialize(): Promise<void> {
    if (!this.accessToken()) return;
    await this.refresh();
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.api.post<AuthResponse>('/auth/login', { email, password });
    this.setSession(res);
    return res;
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await this.api.post<AuthResponse>('/auth/register', { name, email, password });
    this.setSession(res);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post<void>('/auth/logout', {});
    } finally {
      this.user.set(null);
      this.accessToken.set(null);
      writeToken(null);
    }
  }

  async refresh(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const res = await this.api.post<AuthResponse>('/auth/refresh', {});
      this.setSession(res);
      return true;
    } catch {
      this.user.set(null);
      this.accessToken.set(null);
      writeToken(null);
      return false;
    }
  }

  private setSession(res: AuthResponse): void {
    this.accessToken.set(res.accessToken);
    this.user.set(res.user);
    writeToken(res.accessToken);
  }
}