import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsListPage } from './events-list';
import { ApiService } from '../../core/api.service';
import type { Paginated } from '../../core/models';

const emptyPage: Paginated<never> = { data: [], page: 1, limit: 12, total: 0 };
const categories = [{ id: 'c1', name: 'Comedy', slug: 'comedy' }];

describe('EventsListPage', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let listCalls: string[];

  const setup = async (initialQuery: Record<string, string> = {}) => {
    navigate = vi.fn().mockResolvedValue(true);
    listCalls = [];

    const api = {
      get: vi.fn(async (path: string, params?: Record<string, unknown>) => {
        if (path === '/categories') return categories as never;
        listCalls.push(new URLSearchParams(params as Record<string, string>).toString());
        return emptyPage as never;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [EventsListPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: {
              subscribe: (fn: (p: Record<string, string>) => void) => {
                fn(initialQuery);
                return { unsubscribe: () => undefined };
              },
            },
            snapshot: { queryParamMap: convertToParamMap(initialQuery) },
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventsListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('mounts without NG01050 and renders category names', async () => {
    const { fixture } = await setup();
    const option = fixture.nativeElement.querySelector(
      'select option:nth-child(2)',
    ) as HTMLOptionElement;
    expect(option.textContent?.trim()).toBe('Comedy');
    expect(option.value).toBe('comedy');
  });

  it('binds the filter form so typed input reaches the FormGroup', async () => {
    const { fixture } = await setup();
    const input = fixture.nativeElement.querySelector(
      'input[formControlName="q"]',
    ) as HTMLInputElement;

    input.value = 'jazz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.filters.controls.q.value).toBe('jazz');
  });

  it('binds the date controls that previously had no labels', async () => {
    const { fixture } = await setup();
    const input = fixture.nativeElement.querySelector(
      'input[formControlName="dateFrom"]',
    ) as HTMLInputElement;

    input.value = '2027-03-05';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.filters.controls.dateFrom.value).toBe('2027-03-05');
  });

  it('labels the date inputs so from and to are distinguishable', async () => {
    const { fixture } = await setup();
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.f-label')].map(
      (l) => l.querySelector('span')?.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Search',
      'Category',
      'City',
      'From date',
      'To date',
      'Min price (€)',
      'Max price (€)',
    ]);
  });

  it('submits the current form values as query params', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    page.filters.patchValue({ city: 'Berlin', dateFrom: '2027-03-05', dateTo: '2027-03-05' });
    page.applyFilters();

    expect(navigate).toHaveBeenCalledWith(['/events'], {
      queryParams: { city: 'Berlin', dateFrom: '2027-03-05', dateTo: '2027-03-05' },
    });
  });

  it('converts price inputs from euros to cents', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    page.filters.patchValue({ priceMin: 10, priceMax: 50 });
    page.applyFilters();

    expect(navigate).toHaveBeenCalledWith(['/events'], {
      queryParams: { priceMin: 1000, priceMax: 5000 },
    });
  });

  it('shows cents in the URL as euros in the price inputs after a reload', async () => {
    const { fixture } = await setup({ priceMin: '1000', priceMax: '5000' });
    const page = fixture.componentInstance;

    expect(page.filters.value.priceMin).toBe(10);
    expect(page.filters.value.priceMax).toBe(50);

    const min = fixture.nativeElement.querySelector(
      'input[formControlName="priceMin"]',
    ) as HTMLInputElement;
    const max = fixture.nativeElement.querySelector(
      'input[formControlName="priceMax"]',
    ) as HTMLInputElement;
    expect(min.value).toBe('10');
    expect(max.value).toBe('50');
  });

  it('keeps a zero price bound at zero instead of dropping it', async () => {
    const { fixture } = await setup({ priceMin: '0', priceMax: '0' });
    const page = fixture.componentInstance;

    expect(page.filters.value.priceMin).toBe(0);
    expect(page.filters.value.priceMax).toBe(0);
  });

  it('round-trips euros -> cents in the URL -> euros in the inputs', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    page.filters.patchValue({ priceMin: 25, priceMax: 50 });
    page.applyFilters();
    const sent = navigate.mock.calls.at(-1)?.[1]?.queryParams as Record<string, number>;
    expect(sent).toEqual({ priceMin: 2500, priceMax: 5000 });

    TestBed.resetTestingModule();
    const reloaded = await setup({
      priceMin: String(sent['priceMin']),
      priceMax: String(sent['priceMax']),
    });
    expect(reloaded.fixture.componentInstance.filters.value.priceMin).toBe(25);
    expect(reloaded.fixture.componentInstance.filters.value.priceMax).toBe(50);
  });

  it('navigates once after the search debounce rather than per keystroke', async () => {
    vi.useFakeTimers();
    try {
      const { fixture } = await setup();
      const page = fixture.componentInstance;

      page.filters.controls.q.setValue('j');
      page.filters.controls.q.setValue('ja');
      page.filters.controls.q.setValue('jazz');
      expect(navigate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/events'], { queryParams: { q: 'jazz' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not navigate when the router echoes the same query back into the form', async () => {
    const { fixture } = await setup({ q: 'jazz' });
    const page = fixture.componentInstance;
    navigate.mockClear();

    page.filters.patchValue({ q: 'jazz' }, { emitEvent: false });
    await new Promise((r) => setTimeout(r, 350));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('omits empty filters from the request', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    page.filters.patchValue({ q: '', city: '', dateFrom: '', dateTo: '', priceMin: null });
    page.applyFilters();
    await new Promise((r) => setTimeout(r, 0));

    expect(listCalls.at(-1)).toBe('page=1&limit=12');
  });

  it('clears every filter and drops query params on reset', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    page.filters.patchValue({ q: 'jazz', city: 'Berlin', priceMin: 10 });
    page.reset();

    expect(page.filters.value).toEqual({
      q: '',
      category: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      priceMin: null,
      priceMax: null,
    });
    expect(navigate).toHaveBeenCalledWith(['/events']);
  });
});
