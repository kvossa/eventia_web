import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { NotificationsService } from '../core/notifications.service';
import { ToastService } from '../core/toast.service';

describe('Header mobile menu', () => {
  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => false, user: () => undefined } },
        { provide: CartService, useValue: { loaded: () => true, count: () => 0, sync: vi.fn(), clearLocal: vi.fn() } },
        { provide: NotificationsService, useValue: { unreadCount: () => 0, refresh: vi.fn(), applyUnread: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders the hamburger and guest actions', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="header-menu-toggle"]')).toBeTruthy();
    expect(root.textContent).toContain('Log in');
    expect(root.textContent).toContain('Sign up');
  });

  it('toggles the dropdown nav open and closed', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('[data-testid="header-menu-toggle"]')!;
    const nav = root.querySelector<HTMLElement>('[data-testid="header-nav"]')!;

    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(nav.classList.contains('open')).toBe(false);

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(true);
    expect(nav.classList.contains('open')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
    expect(nav.classList.contains('open')).toBe(false);
  });

  it('closes the menu when a nav link is tapped', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector<HTMLButtonElement>('[data-testid="header-menu-toggle"]')!).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(true);

    (root.querySelector<HTMLElement>('[data-testid="header-nav"]')!).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });
});