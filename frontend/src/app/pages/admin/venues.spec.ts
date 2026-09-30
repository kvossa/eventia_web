import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminVenuesPage } from './venues';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { Venue } from '../../core/models';

const VENUE: Venue = {
  id: 'v1',
  name: 'Huxley Hall',
  city: 'Berlin',
  address: 'Potsdamer Str. 1',
  capacity: 1500,
  description: null,
  imageUrl: null,
};

describe('AdminVenuesPage', () => {
  const setup = async (venues: Venue[] = [VENUE]) => {
    const api = {
      venues: vi.fn().mockResolvedValue(venues),
      venueCreate: vi.fn().mockResolvedValue(venues),
      venueUpdate: vi.fn().mockResolvedValue(venues[0] ?? VENUE),
      venueRemove: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminVenuesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminVenuesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('lists venues with city, address and capacity', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    const row = root.querySelector('[data-testid="admin-venue-v1"]');
    expect(row?.textContent).toContain('Huxley Hall');
    expect(row?.textContent).toContain('Berlin');
    expect(row?.textContent).toContain('Potsdamer Str. 1');
    expect(row?.textContent).toContain('1500');
  });

  it('renders a dash when capacity is unknown', async () => {
    const { fixture } = await setup([{ ...VENUE, capacity: null }]);
    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-venue-v1"]');
    expect(row?.querySelector('.capacity')?.textContent?.trim()).toBe('—');
  });

  it('shows the empty state when there are no venues', async () => {
    const { fixture } = await setup([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-venues-empty"]')).toBeTruthy();
  });

  it('rejects a save with missing required fields', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: '  ', city: 'Berlin', address: '', capacity: null, imageUrl: '', description: '' };

    await fixture.componentInstance.save();

    expect(api.venueCreate).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('error', 'Please fill in name, city and address.');
    expect(fixture.componentInstance.saving()).toBe(false);
  });

  it('normalises optional fields on create', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = {
      name: '  Neue Halle ',
      city: ' Hamburg ',
      address: ' Reeperbahn 1 ',
      capacity: 400,
      imageUrl: '   ',
      description: '  Great room  ',
    };

    await fixture.componentInstance.save();
    fixture.detectChanges();

    expect(api.venueCreate).toHaveBeenCalledWith({
      name: 'Neue Halle',
      city: 'Hamburg',
      address: 'Reeperbahn 1',
      capacity: 400,
      imageUrl: null,
      description: 'Great room',
    });
    expect(toast.show).toHaveBeenCalledWith('success', 'Venue added.');
  });

  it('prefills the form on edit and updates that venue', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: { name: string; capacity: number | null } };

    fixture.componentInstance.startEdit(VENUE);
    fixture.detectChanges();

    expect(page.form.name).toBe('Huxley Hall');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="venue-edit-name"]')).toBeTruthy();

    await fixture.componentInstance.save();
    fixture.detectChanges();

    expect(api.venueUpdate).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ name: 'Huxley Hall', capacity: 1500 }),
    );
    expect(toast.show).toHaveBeenCalledWith('success', 'Venue updated.');
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('clears the edit state on cancel', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.startEdit(VENUE);
    fixture.componentInstance.cancelEdit();
    fixture.detectChanges();

    expect(fixture.componentInstance.editingId()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="venue-edit-name"]')).toBeNull();
  });

  it('deletes only after confirmation', async () => {
    const { fixture, api, toast } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await fixture.componentInstance.remove(VENUE);
    expect(api.venueRemove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await fixture.componentInstance.remove(VENUE);
    expect(api.venueRemove).toHaveBeenCalledWith('v1');
    expect(toast.show).toHaveBeenCalledWith('success', 'Venue deleted.');
  });

  it('reports a failed load through the toast', async () => {
    const api = {
      venues: vi.fn().mockRejectedValue(new Error('load boom')),
      venueCreate: vi.fn(),
      venueUpdate: vi.fn(),
      venueRemove: vi.fn(),
    };
    const toast = { show: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AdminVenuesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(AdminVenuesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toast.show).toHaveBeenCalledWith('error', 'load boom');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});