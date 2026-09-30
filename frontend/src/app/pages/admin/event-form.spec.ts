import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventFormPage } from './event-form';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { EventFormValue } from '../../core/models';

type ApiMock = {
  categories: ReturnType<typeof vi.fn>;
  venues: ReturnType<typeof vi.fn>;
  organizers: ReturnType<typeof vi.fn>;
  adminEvent: ReturnType<typeof vi.fn>;
  eventUpdate: ReturnType<typeof vi.fn>;
  eventCreate: ReturnType<typeof vi.fn>;
};

const existingEvent = {
  id: 'e1',
  name: 'Clear Me',
  description: 'Old description',
  imageUrl: 'https://example.com/old.png',
  maxCapacity: 500,
  accessibilityInfo: 'Step free',
  categoryId: 'c1',
  organizerId: 'o1',
  venueId: 'v1',
  dateTime: '2030-05-05T18:00:00.000Z',
  startTime: null,
  endTime: null,
  city: 'Berlin',
  address: 'Mainstr. 1',
  status: 'draft',
  featured: false,
  reservedSeating: false,
};

describe('AdminEventFormPage optional fields', () => {
  let api: ApiMock;
  let fixture: ReturnType<typeof TestBed.createComponent<AdminEventFormPage>>;

  const setup = async (routeId: string | null = 'e1'): Promise<void> => {
    api = {
      categories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Music' }]),
      venues: vi.fn().mockResolvedValue([{ id: 'v1', name: 'Arena' }]),
      organizers: vi.fn().mockResolvedValue([{ id: 'o1', name: 'Events Inc' }]),
      adminEvent: vi.fn().mockResolvedValue(existingEvent),
      eventUpdate: vi.fn().mockResolvedValue(existingEvent),
      eventCreate: vi.fn().mockResolvedValue(existingEvent),
    };

    await TestBed.configureTestingModule({
      imports: [AdminEventFormPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: { show: vi.fn() } },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(routeId ? { id: routeId } : {}) } } },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const created = TestBed.createComponent(AdminEventFormPage);
    await created.componentInstance.ngOnInit();
    created.detectChanges();
    fixture = created;
  };

  beforeEach(() => TestBed.resetTestingModule());

  const form = (): EventFormValue => fixture.componentInstance['value'] as unknown as EventFormValue;

  it('sends the optional fields it loaded so saving them is lossless', async () => {
    await setup();
    fixture.componentInstance['value'].description = '  Fresh description  ';
    fixture.componentInstance['value'].imageUrl = '  https://example.com/new.png  ';

    await fixture.componentInstance.save();

    const body = api.eventUpdate.mock.calls[0]?.[1] as EventFormValue;
    expect(api.eventUpdate).toHaveBeenCalledWith('e1', expect.anything());
    expect(body.description).toBe('Fresh description');
    expect(body.imageUrl).toBe('https://example.com/new.png');
    expect(body.maxCapacity).toBe(500);
  });

  it('sends null when the admin clears description, image and capacity', async () => {
    await setup();
    const value = fixture.componentInstance['value'];
    value.description = '';
    value.imageUrl = '   ';
    value.maxCapacity = null;

    await fixture.componentInstance.save();

    const body = api.eventUpdate.mock.calls[0]?.[1] as EventFormValue;
    expect(body.description).toBeNull();
    expect(body.imageUrl).toBeNull();
    expect(body.maxCapacity).toBeNull();
  });

  it('still sends untouched optional fields on the create path', async () => {
    await setup(null);
    const value = fixture.componentInstance['value'];
    value.name = 'Brand New';
    value.categoryId = 'c1';
    value.organizerId = 'o1';
    value.venueId = 'v1';
    value.dateTime = '2030-06-06T19:00';
    value.description = '';
    value.imageUrl = '';
    value.maxCapacity = null;

    await fixture.componentInstance.save();

    expect(api.eventCreate).toHaveBeenCalledTimes(1);
    const body = api.eventCreate.mock.calls[0]?.[0] as EventFormValue;
    expect(body.description).toBeNull();
    expect(body.imageUrl).toBeNull();
    expect(body.maxCapacity).toBeNull();
  });
});
