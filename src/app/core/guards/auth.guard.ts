import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { RolUsuario } from '../models/llamma.models';

/** Exige una sesión activa; conserva la ruta solicitada para volver tras el login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { redirect: state.url },
  });
};

/** Restringe el acceso a los roles indicados en `route.data.roles`. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] ?? []) as RolUsuario[];

  if (!auth.autenticado()) {
    return router.createUrlTree(['/login']);
  }
  if (!roles.length || auth.tieneRol(...roles)) return true;

  return router.createUrlTree(['/dashboard']);
};

/** Evita mostrar el login a quien ya tiene sesión. */
export const publicOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.autenticado() ? router.createUrlTree(['/dashboard']) : true;
};
