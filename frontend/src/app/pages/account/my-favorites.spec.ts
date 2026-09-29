import { TestBed } from '@angular/core/testing';
import { Router, convertToParamMap, ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyFavoritesPage } from './my-favorites';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { FavoriteView } from '../../core/models';

const favorite = {
  id: 'e1',
  name: 'Symphony Under Stars',
  dateTime: '2030-03-14T19:30:00.000Z',
  city: 'Berlin',
  favoritedAt: '2026-01-02T10:00:00.000Z',
  venue: { name: 'Eventia Arena', address: 'Mainstr. 1' },
  availability: { state: 'available', remaining: 10 },
} as unknown as FavoriteView;

describe('MyFavoritesPage', () => {
  const setup = async () => {
    const api = {
      favorites: vi.fn().mockResolvedValue({ data: [favorite], page: 1, limit: 20, total: 1 }),
      favoriteRemove: vi.fn().mockResolvedValue({}),
    };

    await TestBed.configureTestingModule({
      imports: [MyFavoritesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyFavoritesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders the event date as a formatted date, not a raw ISO string', async () => {
    const fixture = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('2030-03-14T19:30:00.000Z');
    expect(text).toContain('March');
    expect(text).toContain('2030');
  });

  it('marks the remove button with the shared danger button class', async () => {
    const fixture = await setup();
    const btn = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="favorite-remove-e1"]',
    ) as HTMLButtonElement;

    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('btn-danger')).toBe(true);
  });
});
