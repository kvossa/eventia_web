import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AdminNav } from './admin-nav';

@Component({
  selector: 'app-host',
  imports: [AdminNav],
  template: `<app-admin-nav><p class="page-content" data-testid="projected">Hello admin</p></app-admin-nav>`,
})
class Host {}

describe('AdminNav shell', () => {
  it('renders the sidebar links', async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const labels = [...(root.querySelectorAll('[data-testid="admin-nav-links"] a'))].map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'Events', 'Orders', 'Users', 'Venues', 'Organizers', 'Categories']);
  });

  it('projects page content into the main column', async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="admin-nav"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="projected"]')?.textContent).toBe('Hello admin');
  });
});