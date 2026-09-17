import { Routes } from '@angular/router';
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
    path: 'my-tickets',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tickets/my-tickets').then((m) => m.MyTicketsPage),
  },
  { path: '**', redirectTo: '' },
];