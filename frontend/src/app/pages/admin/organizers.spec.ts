import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrganizersPage } from './organizers';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import type { Organizer } from '../../core/models';

const ORGANIZER: Organizer = {
  id: 'o1',
  name: 'Live Nation',
  slug: 'live-nation',
  description: 'Promoter',
  websiteUrl: 'https://example.com',
  logoUrl: null,
};

describe('AdminOrganizersPage', () => {
  const setup = async (organizers: Organizer[] = [ORGANIZER]) => {
    const api = {
      organizers: vi.fn().mockResolvedValue(organizers),
      organizerCreate: vi.fn().mockResolvedValue(ORGANIZER),
      organizerUpdate: vi.fn().mockResolvedValue(ORGANIZER),
      organizerRemove: vi.fn().mockResolvedValue(undefined),
    };
    const toast = { show: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminOrganizersPage],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        provideRouter([]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminOrganizersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api, toast };
  };

  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('lists organizers with slug and website', async () => {
    const { fixture } = await setup();
    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-organizer-o1"]');
    expect(row?.textContent).toContain('Live Nation');
    expect(row?.textContent).toContain('live-nation');
  });

  it('shows the empty state when there are no organizers', async () => {
    const { fixture } = await setup([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="admin-organizers-empty"]')).toBeTruthy();
  });

  it('requires a name and slug', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: ' ', slug: 'abc' };

    await fixture.componentInstance.save();
    expect(api.organizerCreate).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('error', 'Please fill in name and slug.');
  });

  it('omits blank optional fields on create', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: '  Nova Promoter ', slug: ' nova ', websiteUrl: '  ', logoUrl: '', description: '  ' };

    await fixture.componentInstance.save();

    expect(api.organizerCreate).toHaveBeenCalledWith({ name: 'Nova Promoter', slug: 'nova' });
    expect(toast.show).toHaveBeenCalledWith('success', 'Organizer added.');
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('prefills and updates on edit', async () => {
    const { fixture, api, toast } = await setup();
    const page = fixture.componentInstance as unknown as {
      form: { name: string; websiteUrl: string; description: string };
    };

    fixture.componentInstance.startEdit(ORGANIZER);
    fixture.detectChanges();
    expect(page.form.name).toBe('Live Nation');
    expect(page.form.websiteUrl).toBe('https://example.com');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="organizer-edit-name"]')).toBeTruthy();

    page.form.description = '  International promoter  ';
    await fixture.componentInstance.save();

    expect(api.organizerUpdate).toHaveBeenCalledWith('o1', {
      name: 'Live Nation',
      slug: 'live-nation',
      websiteUrl: 'https://example.com',
      description: 'International promoter',
    });
    expect(toast.show).toHaveBeenCalledWith('success', 'Organizer updated.');
  });

  it('deletes only after confirmation', async () => {
    const { fixture, api } = await setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await fixture.componentInstance.remove(ORGANIZER);
    expect(api.organizerRemove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await fixture.componentInstance.remove(ORGANIZER);
    expect(api.organizerRemove).toHaveBeenCalledWith('o1');
  });

  it('reports save errors and clears the busy flag', async () => {
    const { fixture, api, toast } = await setup();
    api.organizerCreate.mockRejectedValueOnce(new Error('create boom'));
    const page = fixture.componentInstance as unknown as { form: Record<string, unknown> };
    page.form = { name: 'Nova', slug: 'nova' };

    await fixture.componentInstance.save();
    expect(toast.show).toHaveBeenCalledWith('error', 'create boom');
    expect(fixture.componentInstance.saving()).toBe(false);
  });
});