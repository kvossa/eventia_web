import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from './env';
import {
  AdminEventQueryParams,
  AdminOrderQueryParams,
  AdminStats,
  AdminUserQueryParams,
  ApiError,
  Category,
  CategoryInput,
  EventDetail,
  EventFormValue,
  EventListItem,
  FavoriteAddResponse,
  FavoriteRemoveResponse,
  FavoriteView,
  MyOrderListItem,
  NotificationListResponse,
  NotificationPreferencesInput,
  NotificationView,
  OrderDetailView,
  OrderListParams,
  Organizer,
  OrganizerInput,
  Paginated,
  PasswordChangeInput,
  PasswordChangeResponse,
  ProfileView,
  PublicUser,
  TicketType,
  TicketTypeInput,
  UnreadCountResponse,
  UserUpdateInput,
  Venue,
  VenueInput,
} from './models';
import type { OrderStatus, UserRole } from '@eventia/shared';

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

  cancelOrder<T = OrderDetailView>(id: string): Promise<T> {
    return this.post<T>(`/api/v1/orders/${id}/cancel`, {});
  }

  updateNotificationPreferences<T = NotificationPreferencesInput>(body: NotificationPreferencesInput): Promise<T> {
    return this.patch<T>('/api/v1/users/me/notification-preferences', body);
  }

  notifications(params?: Record<string, string | number | boolean | undefined>): Promise<NotificationListResponse> {
    return this.get<NotificationListResponse>('/api/v1/notifications', params);
  }

  unreadNotificationsCount(): Promise<UnreadCountResponse> {
    return this.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  }

  markNotificationRead(id: string): Promise<NotificationView> {
    return this.patch<NotificationView>(`/api/v1/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.patch<{ updated: number }>('/api/v1/notifications/read-all', {});
  }

  adminStats(): Promise<AdminStats> {
    return this.get<AdminStats>('/api/v1/admin/stats');
  }

  adminUsers(params?: AdminUserQueryParams): Promise<Paginated<PublicUser>> {
    return this.get<Paginated<PublicUser>>('/api/v1/admin/users', params as Record<string, string | number | boolean | undefined>);
  }

  adminUserRole(id: string, role: UserRole): Promise<PublicUser> {
    return this.patch<PublicUser>(`/api/v1/admin/users/${id}`, { role });
  }

  adminOrders(params?: AdminOrderQueryParams): Promise<Paginated<OrderDetailView>> {
    return this.get<Paginated<OrderDetailView>>(
      '/api/v1/admin/orders',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  adminOrder(id: string): Promise<OrderDetailView> {
    return this.get<OrderDetailView>(`/api/v1/admin/orders/${id}`);
  }

  adminOrderStatus(id: string, status: OrderStatus): Promise<OrderDetailView> {
    return this.patch<OrderDetailView>(`/api/v1/admin/orders/${id}/status`, { status });
  }

  adminOrderRefund(id: string): Promise<OrderDetailView> {
    return this.post<OrderDetailView>(`/api/v1/admin/orders/${id}/refund`, {});
  }

  adminOrdersExport(params?: AdminOrderQueryParams): Promise<{ csv: string }> {
    return this.get<{ csv: string }>(
      '/api/v1/admin/orders/export',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  categories(): Promise<Category[]> {
    return this.get<Category[]>('/api/v1/categories');
  }

  venueCreate(body: VenueInput): Promise<Venue> {
    return this.post<Venue>('/api/v1/venues', body);
  }

  venueUpdate(id: string, body: VenueInput): Promise<Venue> {
    return this.patch<Venue>(`/api/v1/venues/${id}`, body);
  }

  venueRemove(id: string): Promise<void> {
    return this.delete<void>(`/api/v1/venues/${id}`);
  }

  organizerCreate(body: OrganizerInput): Promise<Organizer> {
    return this.post<Organizer>('/api/v1/organizers', body);
  }

  organizerUpdate(id: string, body: OrganizerInput): Promise<Organizer> {
    return this.patch<Organizer>(`/api/v1/organizers/${id}`, body);
  }

  organizerRemove(id: string): Promise<void> {
    return this.delete<void>(`/api/v1/organizers/${id}`);
  }

  categoryCreate(body: CategoryInput): Promise<Category> {
    return this.post<Category>('/api/v1/categories', body);
  }

  categoryUpdate(id: string, body: CategoryInput): Promise<Category> {
    return this.patch<Category>(`/api/v1/categories/${id}`, body);
  }

  categoryRemove(id: string): Promise<void> {
    return this.delete<void>(`/api/v1/categories/${id}`);
  }

  venues(): Promise<Venue[]> {
    return this.get<Venue[]>('/api/v1/venues');
  }

  organizers(): Promise<Organizer[]> {
    return this.get<Organizer[]>('/api/v1/organizers');
  }

  adminEvents(params?: AdminEventQueryParams): Promise<Paginated<EventListItem>> {
    return this.get<Paginated<EventListItem>>(
      '/api/v1/admin/events',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  adminEvent(id: string): Promise<EventDetail> {
    return this.get<EventDetail>(`/api/v1/admin/events/${id}`);
  }

  eventCreate(body: EventFormValue): Promise<EventListItem> {
    return this.post<EventListItem>('/api/v1/events', body);
  }

  eventUpdate(id: string, body: EventFormValue): Promise<EventListItem> {
    return this.patch<EventListItem>(`/api/v1/events/${id}`, body);
  }

  eventPublish(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/api/v1/events/${id}/publish`, {});
  }

  eventUnpublish(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/api/v1/events/${id}/unpublish`, {});
  }

  eventMarkSoldOut(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/api/v1/events/${id}/mark-sold-out`, {});
  }

  eventDuplicate(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/api/v1/events/${id}/duplicate`, {});
  }

  eventRemove(id: string): Promise<void> {
    return this.delete<void>(`/api/v1/events/${id}`);
  }

  ticketTypesByEvent(eventId: string): Promise<TicketType[]> {
    return this.get<TicketType[]>('/api/v1/ticket-types/by-event', { eventId });
  }

  ticketTypeCreate(body: TicketTypeInput): Promise<TicketType> {
    return this.post<TicketType>('/api/v1/ticket-types', body);
  }

  ticketTypeUpdate(id: string, body: TicketTypeInput): Promise<TicketType> {
    return this.patch<TicketType>(`/api/v1/ticket-types/${id}`, body);
  }

  ticketTypeRemove(id: string): Promise<void> {
    return this.delete<void>(`/api/v1/ticket-types/${id}`);
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