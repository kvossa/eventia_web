import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

const withCredentials = (r: HttpRequest<unknown>): HttpRequest<unknown> => {
  if (r.withCredentials && r.credentials === 'include') return r;
  return r.clone({ withCredentials: true, credentials: 'include' });
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const withToken = (r: HttpRequest<unknown>): HttpRequest<unknown> => {
    const token = auth.accessToken();
    if (!token || AUTH_FREE_PATHS.some((p) => r.url.endsWith(p))) return r;
    return r.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  };

  return next(withCredentials(withToken(req))).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !AUTH_FREE_PATHS.some((p) => req.url.endsWith(p))) {
        return from(auth.refresh()).pipe(
          switchMap((ok) => {
            if (!ok) return throwError(() => err);
            return next(withCredentials(withToken(req)));
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};