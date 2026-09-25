import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  {
    path: 'events',
    loadComponent: () => import('./pages/events/events-list').then((m) => m.EventsListPage),
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./pages/events/event-detail').then((m) => m.EventDetailPage),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.CheckoutPage),
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./pages/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./pages/auth/register').then((m) => m.RegisterPage),
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () => import('./pages/auth/reset-password').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'my-tickets',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tickets/my-tickets').then((m) => m.MyTicketsPage),
  },
  {
    path: 'my-favorites',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/my-favorites').then(
      (m) => m.MyFavoritesPage,
    ),
  },
  {
    path: 'my-orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/my-orders').then((m) => m.MyOrdersPage),
  },
  {
    path: 'my-orders/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders/my-order-detail').then(
      (m) => m.MyOrderDetailPage,
    ),
  },
  {
    path: 'my-profile',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/my-profile').then(
      (m) => m.MyProfilePage,
    ),
  },
  {
    path: 'my-notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/my-notifications').then(
      (m) => m.MyNotificationsPage,
    ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/dashboard').then((m) => m.AdminDashboardPage),
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/users').then((m) => m.AdminUsersPage),
  },
  {
    path: 'admin/orders',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/orders').then((m) => m.AdminOrdersPage),
  },
  {
    path: 'admin/orders/:id',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/order-detail').then((m) => m.AdminOrderDetailPage),
  },
  {
    path: 'admin/events',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/events').then((m) => m.AdminEventsPage),
  },
  {
    path: 'admin/events/new',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/event-form').then((m) => m.AdminEventFormPage),
  },
  {
    path: 'admin/events/:id/edit',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/event-form').then((m) => m.AdminEventFormPage),
  },
  {
    path: 'admin/events/:id/ticket-types',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/ticket-types').then((m) => m.AdminTicketTypesPage),
  },
  {
    path: 'admin/venues',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/venues').then((m) => m.AdminVenuesPage),
  },
  {
    path: 'admin/venues/:id/layout',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/venue-layout').then((m) => m.AdminVenueLayoutPage),
  },
  {
    path: 'admin/organizers',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/organizers').then((m) => m.AdminOrganizersPage),
  },
  {
    path: 'admin/categories',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/categories').then((m) => m.AdminCategoriesPage),
  },
  { path: '**', redirectTo: '' },
];
