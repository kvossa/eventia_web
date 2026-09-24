import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from './env';
import {
  ApiError,
  FavoriteAddResponse,
  FavoriteRemoveResponse,
  FavoriteView,
  MyOrderListItem,
  OrderDetailView,
  NotificationPreferencesInput,
  OrderListParams,
  Paginated,
  PasswordChangeInput,
  PasswordChangeResponse,
  ProfileView,
  UserUpdateInput,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request(() =>
      lastValueFrom(this.http.get<T>(this.url(path), { params: this.toParams(params) })),
    );
  }

  post<T>(path: string, body: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request(() =>
      lastValueFrom(this.http.post<T>(this.url(path), body, { params: this.toParams(params) })),
    );
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request(() => lastValueFrom(this.http.patch<T>(this.url(path), body)));
  }

  delete<T>(path: string): Promise<T> {
    return this.request(() => lastValueFrom(this.http.delete<T>(this.url(path))));
  }

  me<T = ProfileView>(): Promise<T> {
    return this.get<T>('/api/v1/users/me');
  }

  updateProfile<T = ProfileView>(body: UserUpdateInput): Promise<T> {
    return this.patch<T>('/api/v1/users/me', body);
  }

  changePassword(body: PasswordChangeInput): Promise<PasswordChangeResponse> {
    return this.post<PasswordChangeResponse>('/api/v1/auth/change-password', body);
  }

  favorites<T = Paginated<FavoriteView>>(params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.get<T>('/api/v1/favorites', params);
  }

  favoriteAdd<T = FavoriteAddResponse>(eventId: string): Promise<T> {
    return this.post<T>(`/api/v1/favorites/${eventId}`, {});
  }

  favoriteRemove<T = FavoriteRemoveResponse>(eventId: string): Promise<T> {
    return this.delete<T>(`/api/v1/favorites/${eventId}`);
  }

  myOrders<T = Paginated<MyOrderListItem>>(params: OrderListParams): Promise<T> {
    return this.get<T>('/api/v1/orders', params as Record<string, string | number | boolean | undefined>);
  }

  myOrder<T = OrderDetailView>(id: string): Promise<T> {
    return this.get<T>(`/api/v1/orders/${id}`);
  }

  updateNotificationPreferences<T = NotificationPreferencesInput>(body: NotificationPreferencesInput): Promise<T> {
    return this.patch<T>('/api/v1/users/me/notification-preferences', body);
  }

  private async request<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        throw this.toApiError(err);
      }
      throw err;
    }
  }

  private toApiError(err: HttpErrorResponse): ApiError {
    const body = err.error as { code?: string; errors?: string[] } | null;
    const errors = Array.isArray(body?.errors) && body.errors.length ? body.errors : [];
    const fallback = err.status === 0 ? 'The server is unreachable. Please try again later.' : 'Something went wrong.';
    return {
      code: body?.code ?? 'UNKNOWN_ERROR',
      statusCode: err.status,
      message: errors[0] ?? fallback,
      errors,
    };
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path}`;
  }

  private toParams(params?: Record<string, string | number | boolean | undefined>): HttpParams {
    let http = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          http = http.set(key, String(value));
        }
      }
    }
    return http;
  }
}