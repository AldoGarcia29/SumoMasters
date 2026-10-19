import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/**
 * Permite el acceso solo si el usuario tiene al menos uno de los roles indicados.
 * Si no tiene sesión lo manda al login; si no tiene permiso, al dashboard.
 */
export const roleGuard =
  (allowedRoles: Role[]): CanActivateFn =>
  () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    return authService.hasAnyRole(allowedRoles)
      ? true
      : router.createUrlTree(['/dashboard']);
  };
