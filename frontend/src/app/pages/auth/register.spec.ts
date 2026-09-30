import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './register';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';

describe('RegisterPage', () => {
  const fill = (page: RegisterPage, password = 'secret123') => {
    page.form.controls.name.setValue('Ada Lovelace');
    page.form.controls.email.setValue('ada@example.com');
    page.form.controls.password.setValue(password);
    page.form.controls.confirmPassword.setValue(password);
  };

  const setup = async (error?: unknown) => {
    const auth = {
      register: error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue({ accessToken: 't' }),
      user: () => ({ name: 'Ada Lovelace' }),
    };
    const cart = { sync: vi.fn().mockResolvedValue(undefined) };
    const toast = { show: vi.fn() };
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CartService, useValue: cart },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    return { fixture, auth, cart, toast, router };
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('rejects non-matching passwords', async () => {
    const { fixture, auth } = await setup();
    const page = fixture.componentInstance;

    fill(page, 'secret123');
    page.form.controls.confirmPassword.setValue('different');
    expect(page.form.invalid).toBe(true);

    await page.submit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('requires a minimum password length', async () => {
    const { fixture } = await setup();
    const page = fixture.componentInstance;

    fill(page, 'short');
    expect(page.form.controls.password.errors).toBeTruthy();
    expect(page.form.invalid).toBe(true);
  });

  it('registers the user and syncs the cart', async () => {
    const { fixture, auth, cart, toast, router } = await setup();
    const page = fixture.componentInstance;

    fill(page);
    await page.submit();

    expect(auth.register).toHaveBeenCalledWith('Ada Lovelace', 'ada@example.com', 'secret123');
    expect(cart.sync).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(toast.show).toHaveBeenCalledWith('success', 'Welcome, Ada Lovelace!');
    expect(page.busy()).toBe(false);
  });

  it('maps a taken email to a friendly error', async () => {
    const { fixture, toast, router } = await setup({ code: 'EMAIL_TAKEN', statusCode: 409, message: 'Email taken.' });
    const page = fixture.componentInstance;

    fill(page);
    await page.submit();

    expect(toast.show).toHaveBeenCalledWith('error', 'An account with this email already exists.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('toggles password display', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const fields = [...(root.querySelectorAll<HTMLInputElement>('input[type="password"], input[type="text"]'))].filter(
      (i) => i.id !== 'name' && i.id !== 'email',
    );
    const toggle = root.querySelector('.toggle') as HTMLButtonElement;

    for (const input of fields) expect(input.type).toBe('password');
    toggle.click();
    fixture.detectChanges();
    for (const input of fields) expect(input.type).toBe('text');
  });
});