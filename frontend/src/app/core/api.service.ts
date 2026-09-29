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
  EventSeatMap,
  FavoriteAddResponse,
  FavoriteRemoveResponse,
  FavoriteView,
  ForgotPasswordInput,
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
  ResetPasswordInput,
  RowDraftInput,
  RowView,
  SectionInput,
  SectionView,
  TicketType,
  TicketTypeInput,
  UnreadCountResponse,
  UserUpdateInput,
  Venue,
  VenueInput,
  VenueLayoutView,
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

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request(() => lastValueFrom(this.http.put<T>(this.url(path), body)));
  }

  delete<T>(path: string): Promise<T> {
    return this.request(() => lastValueFrom(this.http.delete<T>(this.url(path))));
  }

  me<T = ProfileView>(): Promise<T> {
    return this.get<T>('/users/me');
  }

  updateProfile<T = ProfileView>(body: UserUpdateInput): Promise<T> {
    return this.patch<T>('/users/me', body);
  }

  changePassword(body: PasswordChangeInput): Promise<PasswordChangeResponse> {
    return this.post<PasswordChangeResponse>('/auth/change-password', body);
  }

  forgotPassword(body: ForgotPasswordInput): Promise<PasswordChangeResponse> {
    return this.post<PasswordChangeResponse>('/auth/forgot-password', body);
  }

  resetPassword(body: ResetPasswordInput): Promise<PasswordChangeResponse> {
    return this.post<PasswordChangeResponse>('/auth/reset-password', body);
  }

  favorites<T = Paginated<FavoriteView>>(params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.get<T>('/favorites', params);
  }

  favoriteAdd<T = FavoriteAddResponse>(eventId: string): Promise<T> {
    return this.post<T>(`/favorites/${eventId}`, {});
  }

  favoriteRemove<T = FavoriteRemoveResponse>(eventId: string): Promise<T> {
    return this.delete<T>(`/favorites/${eventId}`);
  }

  myOrders<T = Paginated<MyOrderListItem>>(params: OrderListParams): Promise<T> {
    return this.get<T>('/orders', params as Record<string, string | number | boolean | undefined>);
  }

  myOrder<T = OrderDetailView>(id: string): Promise<T> {
    return this.get<T>(`/orders/${id}`);
  }

  cancelOrder<T = OrderDetailView>(id: string): Promise<T> {
    return this.post<T>(`/orders/${id}/cancel`, {});
  }

  updateNotificationPreferences<T = NotificationPreferencesInput>(body: NotificationPreferencesInput): Promise<T> {
    return this.patch<T>('/users/me/notification-preferences', body);
  }

  notifications(params?: Record<string, string | number | boolean | undefined>): Promise<NotificationListResponse> {
    return this.get<NotificationListResponse>('/notifications', params);
  }

  unreadNotificationsCount(): Promise<UnreadCountResponse> {
    return this.get<UnreadCountResponse>('/notifications/unread-count');
  }

  markNotificationRead(id: string): Promise<NotificationView> {
    return this.patch<NotificationView>(`/notifications/${id}/read`, {});
  }

  markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.patch<{ updated: number }>('/notifications/read-all', {});
  }

  adminStats(): Promise<AdminStats> {
    return this.get<AdminStats>('/admin/stats');
  }

  adminUsers(params?: AdminUserQueryParams): Promise<Paginated<PublicUser>> {
    return this.get<Paginated<PublicUser>>('/admin/users', params as Record<string, string | number | boolean | undefined>);
  }

  adminUserRole(id: string, role: UserRole): Promise<PublicUser> {
    return this.patch<PublicUser>(`/admin/users/${id}`, { role });
  }

  adminOrders(params?: AdminOrderQueryParams): Promise<Paginated<OrderDetailView>> {
    return this.get<Paginated<OrderDetailView>>(
      '/admin/orders',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  adminOrder(id: string): Promise<OrderDetailView> {
    return this.get<OrderDetailView>(`/admin/orders/${id}`);
  }

  adminOrderStatus(id: string, status: OrderStatus): Promise<OrderDetailView> {
    return this.patch<OrderDetailView>(`/admin/orders/${id}/status`, { status });
  }

  adminOrderRefund(id: string): Promise<OrderDetailView> {
    return this.post<OrderDetailView>(`/admin/orders/${id}/refund`, {});
  }

  adminOrdersExport(params?: AdminOrderQueryParams): Promise<{ csv: string }> {
    return this.get<{ csv: string }>(
      '/admin/orders/export',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  categories(): Promise<Category[]> {
    return this.get<Category[]>('/categories');
  }

  venueCreate(body: VenueInput): Promise<Venue> {
    return this.post<Venue>('/venues', body);
  }

  venueUpdate(id: string, body: VenueInput): Promise<Venue> {
    return this.patch<Venue>(`/venues/${id}`, body);
  }

  venueRemove(id: string): Promise<void> {
    return this.delete<void>(`/venues/${id}`);
  }

  venueLayout(id: string): Promise<VenueLayoutView> {
    return this.get<VenueLayoutView>(`/venues/${id}/layout`);
  }

  sectionCreate(venueId: string, body: SectionInput): Promise<SectionView> {
    return this.post<SectionView>(`/admin/venues/${venueId}/sections`, body);
  }

  sectionUpdate(id: string, body: SectionInput): Promise<SectionView> {
    return this.patch<SectionView>(`/admin/venues/sections/${id}`, body);
  }

  sectionRemove(id: string): Promise<void> {
    return this.delete<void>(`/admin/venues/sections/${id}`);
  }

  rowCreate(sectionId: string, body: RowDraftInput): Promise<RowView> {
    return this.post<RowView>(`/admin/venues/sections/${sectionId}/rows`, body);
  }

  rowUpdate(id: string, body: RowDraftInput): Promise<RowView> {
    return this.patch<RowView>(`/admin/venues/rows/${id}`, body);
  }

  rowRemove(id: string): Promise<void> {
    return this.delete<void>(`/admin/venues/rows/${id}`);
  }

  organizerCreate(body: OrganizerInput): Promise<Organizer> {
    return this.post<Organizer>('/organizers', body);
  }

  organizerUpdate(id: string, body: OrganizerInput): Promise<Organizer> {
    return this.patch<Organizer>(`/organizers/${id}`, body);
  }

  organizerRemove(id: string): Promise<void> {
    return this.delete<void>(`/organizers/${id}`);
  }

  categoryCreate(body: CategoryInput): Promise<Category> {
    return this.post<Category>('/categories', body);
  }

  categoryUpdate(id: string, body: CategoryInput): Promise<Category> {
    return this.patch<Category>(`/categories/${id}`, body);
  }

  categoryRemove(id: string): Promise<void> {
    return this.delete<void>(`/categories/${id}`);
  }

  venues(): Promise<Venue[]> {
    return this.get<Venue[]>('/venues');
  }

  organizers(): Promise<Organizer[]> {
    return this.get<Organizer[]>('/organizers');
  }

  adminEvents(params?: AdminEventQueryParams): Promise<Paginated<EventListItem>> {
    return this.get<Paginated<EventListItem>>(
      '/admin/events',
      params as Record<string, string | number | boolean | undefined>,
    );
  }

  adminEvent(id: string): Promise<EventDetail> {
    return this.get<EventDetail>(`/admin/events/${id}`);
  }

  eventCreate(body: EventFormValue): Promise<EventListItem> {
    return this.post<EventListItem>('/events', body);
  }

  eventUpdate(id: string, body: EventFormValue): Promise<EventListItem> {
    return this.patch<EventListItem>(`/events/${id}`, body);
  }

  eventPublish(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/events/${id}/publish`, {});
  }

  eventUnpublish(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/events/${id}/unpublish`, {});
  }

  eventMarkSoldOut(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/events/${id}/mark-sold-out`, {});
  }

  eventDuplicate(id: string): Promise<EventListItem> {
    return this.post<EventListItem>(`/events/${id}/duplicate`, {});
  }

  eventRemove(id: string): Promise<void> {
    return this.delete<void>(`/events/${id}`);
  }

  ticketTypesByEvent(eventId: string): Promise<TicketType[]> {
    return this.get<TicketType[]>('/ticket-types/by-event', { eventId });
  }

  ticketTypeCreate(body: TicketTypeInput): Promise<TicketType> {
    return this.post<TicketType>('/ticket-types', body);
  }

  ticketTypeUpdate(id: string, body: TicketTypeInput): Promise<TicketType> {
    return this.patch<TicketType>(`/ticket-types/${id}`, body);
  }

  ticketTypeRemove(id: string): Promise<void> {
    return this.delete<void>(`/ticket-types/${id}`);
  }

  ticketTypeSections(id: string, sectionIds: string[]): Promise<{ id: string; sectionIds: string[] }> {
    return this.put<{ id: string; sectionIds: string[] }>(`/ticket-types/${id}/sections`, {
      sectionIds,
    });
  }

  eventSeatMap(id: string): Promise<EventSeatMap> {
    return this.get<EventSeatMap>(`/events/${id}/seat-map`);
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
    const base = environment.apiUrl.replace(/\/+$/, '');
    const suffix = path.startsWith('/api/v1') ? path.slice('/api/v1'.length) || '/' : path;
    return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
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