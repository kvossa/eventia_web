import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCategoriesPage } from './categories';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { Category } from '../../core/models';

const CATEGORY: Category = { id: 'c1', name: 'Rock', slug: 'rock', description: 'Loud music' };

describe('AdminCategoriesPage', () => {
  const setup = async (categories: Category[] = [CATEGORY]) => {
    const api = {
      categories: vi.fn().mockResolvedValue(categories),
      categoryCreate: vi.fn().mockResolvedValue(CATEGORY),
      categoryUpdate: vi.fn().mockResolvedValue(CATEGORY),
      categoryRemove: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminCategoriesPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminCategoriesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('lists categories with slug and description', async () => {
    const { fixture } = await setup();
    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-category-c1"]');
    expect(row?.textContent).toContain('Rock');
    expect(row?.textContent).toContain('rock');
    expect(row?.textContent).toContain('Loud music');
  });

  it('shows the empty state when there are no categories', async () => {
    const { fixture } = await setup([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-categories-empty"]')).toBeTruthy();
  });

  it('requires a name and slug', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: 'Jazz', slug: '   ' };

    await fixture.componentInstance.save();
    expect(api.categoryCreate).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('error', 'Please fill in name and slug.');
  });

  it('trims values and omits a blank description on create', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: ' Jazz ', slug: ' jazz ', description: '   ' };

    await fixture.componentInstance.save();

    expect(api.categoryCreate).toHaveBeenCalledWith({ name: 'Jazz', slug: 'jazz' });
    expect(toast.show).toHaveBeenCalledWith('success', 'Category added.');
  });

  it('prefills and updates on edit, then exits edit mode', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: { name: string; description: string } };

    fixture.componentInstance.startEdit(CATEGORY);
    fixture.detectChanges();
    expect(page.form.name).toBe('Rock');
    expect(page.form.description).toBe('Loud music');

    page.form.name = ' Rock & Metal ';
    await fixture.componentInstance.save();
    fixture.detectChanges();

    expect(api.categoryUpdate).toHaveBeenCalledWith('c1', { name: 'Rock & Metal', slug: 'rock', description: 'Loud music' });
    expect(toast.show).toHaveBeenCalledWith('success', 'Category updated.');
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('cancels the edit and resets the form', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance as unknown as { form: { name: string } };

    fixture.componentInstance.startEdit(CATEGORY);
    page.form.name = 'Draft';
    fixture.componentInstance.cancelEdit();
    fixture.detectChanges();

    expect(page.form.name).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="category-edit-name"]')).toBeNull();
  });

  it('deletes only after confirmation and reports errors', async () => {
    const { fixture, api, toast } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await fixture.componentInstance.remove(CATEGORY);
    expect(api.categoryRemove).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.categoryRemove.mockRejectedValueOnce(new Error('delete boom'));
    await fixture.componentInstance.remove(CATEGORY);

    expect(api.categoryRemove).toHaveBeenCalledWith('c1');
    expect(toast.show).toHaveBeenCalledWith('error', 'delete boom');
  });
});