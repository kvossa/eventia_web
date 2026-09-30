import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminVenueLayoutPage } from './venue-layout';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { SectionView } from '../../core/models';

const SECTION: SectionView = {
  id: 's1',
  name: 'Stalls',
  sortOrder: 1,
  rows: [
    {
      id: 'r1',
      label: 'A',
      seats: [
        { id: 'seat-1', number: 1, isAccessible: true },
        { id: 'seat-2', number: 2, isAccessible: false },
      ],
    },
  ],
};

describe('AdminVenueLayoutPage', () => {
  const routeProvider = {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'v1' : null) } } },
  };

  const setup = async (sections: SectionView[] = [SECTION]) => {
    const api = {
      venueLayout: vi.fn().mockResolvedValue({ sections }),
      sectionCreate: vi.fn().mockResolvedValue({}),
      sectionUpdate: vi.fn().mockResolvedValue({}),
      sectionRemove: vi.fn().mockResolvedValue(undefined),
      rowCreate: vi.fn().mockResolvedValue({}),
      rowUpdate: vi.fn().mockResolvedValue({}),
      rowRemove: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminVenueLayoutPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
        routeProvider,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminVenueLayoutPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('renders sections, rows and accessible seats', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="layout-section-s1"]')?.textContent).toContain('Stalls');
    expect(root.querySelector('[data-testid="layout-row-r1"]')?.textContent).toContain('A');
    expect(root.querySelector('[data-testid="layout-seat-seat-1"]')?.classList).toContain('accessible');
    expect(root.querySelector('[data-testid="layout-seat-seat-2"]')?.classList).not.toContain('accessible');
  });

  it('shows the empty state when the venue has no sections', async () => {
    const { fixture } = await setup([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="layout-empty"]')).toBeTruthy();
  });

  it('adds a section and reloads the layout', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;
    page.newSectionName = '  Balcony  ';
    page.newSectionSort = 2;

    await page.addSection();

    expect(api.sectionCreate).toHaveBeenCalledWith('v1', { name: 'Balcony', sortOrder: 2 });
    expect(api.venueLayout).toHaveBeenCalledTimes(2);
    expect(toast.show).toHaveBeenCalledWith('success', 'Section added.');
    expect(page.newSectionName).toBe('');
    expect(page.newSectionSort).toBe(0);
  });

  it('ignores an empty section name', async () => {
    const { fixture, api } = await setup();
    fixture.componentInstance.newSectionName = '   ';

    await fixture.componentInstance.addSection();
    expect(api.sectionCreate).not.toHaveBeenCalled();
  });

  it('renames a section through the inline editor', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;

    page.startEditSection(SECTION);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="layout-edit-section-name"]')).toBeTruthy();

    page.editSectionName = ' Grand Stalls ';
    page.editSectionSort = 3;
    await page.saveSection(SECTION);
    fixture.detectChanges();

    expect(api.sectionUpdate).toHaveBeenCalledWith('s1', { name: 'Grand Stalls', sortOrder: 3 });
    expect(toast.show).toHaveBeenCalledWith('success', 'Section updated.');
    expect(page.editingSectionId()).toBeNull();
  });

  it('deletes a section only after confirmation', async () => {
    const { fixture, api } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await fixture.componentInstance.deleteSection(SECTION);
    expect(api.sectionRemove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await fixture.componentInstance.deleteSection(SECTION);
    expect(api.sectionRemove).toHaveBeenCalledWith('s1');
  });

  it('creates a row with parsed accessible seat numbers', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;
    page.openRowForm(SECTION);
    fixture.detectChanges();

    page.rowForm.label = '  B ';
    page.rowForm.seatCount = 6;
    page.rowForm.accessible = '1, 1, 4 x, 6';
    await page.saveRow(SECTION);
    fixture.detectChanges();

    expect(api.rowCreate).toHaveBeenCalledWith('s1', { label: 'B', seatCount: 6, accessibleNumbers: [1, 4, 6] });
    expect(toast.show).toHaveBeenCalledWith('success', 'Row added.');
    expect(page.openRowSection()).toBeNull();
  });

  it('updates an existing row prefilled from the seat map', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance;

    page.startEditRow(SECTION, SECTION.rows[0]);
    expect(page.rowForm).toEqual({ rowId: 'r1', label: 'A', seatCount: 2, accessible: '1' });

    page.rowForm.seatCount = 3;
    page.rowForm.accessible = '';
    await page.saveRow(SECTION);

    expect(api.rowUpdate).toHaveBeenCalledWith('r1', { label: 'A', seatCount: 3, accessibleNumbers: [] });
    expect(toast.show).toHaveBeenCalledWith('success', 'Row updated.');
  });

  it('refuses to save an incomplete row', async () => {
    const { fixture, api } = await setup();
    const page = fixture.componentInstance;
    page.openRowForm(SECTION);
    page.rowForm.label = 'C';
    page.rowForm.seatCount = 0;

    await page.saveRow(SECTION);
    expect(api.rowCreate).not.toHaveBeenCalled();
    expect(api.rowUpdate).not.toHaveBeenCalled();
  });

  it('deletes a row only after confirmation', async () => {
    const { fixture, api, toast } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await fixture.componentInstance.deleteRow(SECTION.rows[0]);
    expect(api.rowRemove).toHaveBeenCalledWith('r1');
    expect(toast.show).toHaveBeenCalledWith('success', 'Row deleted.');
  });

  it('reports a failed load and unlocks the page', async () => {
    const api = {
      venueLayout: vi.fn().mockRejectedValue(new Error('layout boom')),
      sectionCreate: vi.fn(),
      sectionUpdate: vi.fn(),
      sectionRemove: vi.fn(),
      rowCreate: vi.fn(),
      rowUpdate: vi.fn(),
      rowRemove: vi.fn(),
    };
    const toast = { show: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AdminVenueLayoutPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
        routeProvider,
      ],
    });
    const fixture = TestBed.createComponent(AdminVenueLayoutPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(toast.show).toHaveBeenCalledWith('error', 'layout boom');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});