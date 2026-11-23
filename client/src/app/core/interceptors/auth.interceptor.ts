import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const AUTH_ENDPOINTS = /\/auth\/(login|register|refresh|logout)$/;

/**
 * Adds the access token to API calls. When a call fails with 401 (token expired),
 * it refreshes the token once and retries; if the refresh also fails, the user is
 * sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);

  const withToken = (request: HttpRequest<unknown>, token: string | null) =>
    request.clone({
      withCredentials: true, // send the refresh cookie when the API is on another domain
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });

  const isAuthEndpoint = AUTH_ENDPOINTS.test(req.url);

  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthEndpoint) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap((token) => next(withToken(req, token))),
        catchError((refreshErr: unknown) => {
          auth.clearSession();
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
