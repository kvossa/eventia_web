import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

export const adminGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.user()) await auth.initialize().catch(() => undefined);

  if (auth.isAuthenticated() && auth.user()?.role === 'admin') return true;

  if (!auth.isAuthenticated()) {
    const returnUrl = route.routeConfig?.path ? route.routeConfig.path : '';
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl } });
  }

  return router.createUrlTree(['/']);
};