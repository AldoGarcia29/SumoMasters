import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const coreApiBase = environment.coreApiUrl.replace(/\/+$/, '');
  const isCoreRequest =
    request.url === coreApiBase || request.url.startsWith(`${coreApiBase}/`);
  const isAuthRequest =
    /\/auth(?:\/|$)/.test(request.url) &&
    !/\/auth\/(?:login|register)(?:[?#]|$)/.test(request.url);
  const isPublicCoreRequest =
    /\/public(?:\/|$)/.test(request.url) ||
    (request.method === 'GET' &&
      /\/evento\/configuracion(?:[?#]|$)/.test(request.url)) ||
    (request.method === 'GET' &&
      /\/torneos\/[^/]+\/bloques\/debug(?:[?#]|$)/.test(request.url)) ||
    (request.method === 'GET' &&
      /\/seguilineas(?:\/(?:activo|activos|stream\/activo|[^/]+\/(?:stream|ranking)))?(?:[?#]|$)/.test(
        request.url,
      ));

  const requestWithToken = token
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : request;

  return next(requestWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        const protectedCoreRequest =
          isCoreRequest && !isPublicCoreRequest;
        const expired = authService.isTokenExpired(token);

        if (isAuthRequest) {
          authService.logout();
        } else if (protectedCoreRequest && expired) {
          authService.logoutForInvalidSession();
        } else if (protectedCoreRequest) {
          authService.markSessionInvalid();
        } else if (expired) {
          authService.logout();
        }
      }

      return throwError(() => error);
    }),
  );
};