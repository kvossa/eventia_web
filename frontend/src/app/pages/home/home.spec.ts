import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home';
import { ApiService } from '../../core/api.service';
import type { Paginated } from '../../core/models';

const emptyPage: Paginated<never> = { data: [], page: 1, limit: 8, total: 0 };

describe('HomePage search', () => {
  let navigate: ReturnType<typeof vi.fn>;

  const setup = async () => {
    navigate = vi.fn().mockResolvedValue(true);
    const api = {
      get: vi.fn(async (path: string) => (path === '/categories' ? [] : emptyPage) as never),
    };

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => TestBed.resetTestingModule());

  const submit = (fixture: { nativeElement: HTMLElement; detectChanges: () => void }) => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  it('prevents the native form submit that reloaded the page', async () => {
    const fixture = await setup();
    const event = submit(fixture);

    expect(event.defaultPrevented).toBe(true);
  });

  it('navigates to /events with the trimmed keyword', async () => {
    const fixture = await setup();
    const input = fixture.nativeElement.querySelector(
      '[data-testid="hero-search"]',
    ) as HTMLInputElement;

    input.value = '  jazz  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submit(fixture);

    expect(navigate).toHaveBeenCalledWith(['/events'], { queryParams: { q: 'jazz' } });
  });

  it('omits the keyword when the search box is empty', async () => {
    const fixture = await setup();

    submit(fixture);

    expect(navigate).toHaveBeenCalledWith(['/events'], { queryParams: {} });
  });

  it('fires exactly one navigation per search', async () => {
    const fixture = await setup();
    const input = fixture.nativeElement.querySelector(
      '[data-testid="hero-search"]',
    ) as HTMLInputElement;

    input.value = 'rock';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submit(fixture);

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
