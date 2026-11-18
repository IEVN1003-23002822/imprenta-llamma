import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authGuard, publicOnlyGuard, roleGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('guards de autenticación', () => {
  const auth = {
    autenticado: vi.fn(() => false),
    tieneRol: vi.fn(() => false),
  };

  const ruta = (roles?: string[]) =>
    ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;

  const estado = { url: '/pedidos' } as RouterStateSnapshot;

  function ejecutar(
    guard: CanActivateFn,
    route: ActivatedRouteSnapshot = ruta(),
    state: RouterStateSnapshot = estado,
  ) {
    return TestBed.runInInjectionContext(() => guard(route, state));
  }

  beforeEach(() => {
    auth.autenticado.mockReturnValue(false);
    auth.tieneRol.mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  describe('authGuard', () => {
    it('deja pasar con una sesión activa', () => {
      auth.autenticado.mockReturnValue(true);

      expect(ejecutar(authGuard)).toBe(true);
    });

    it('redirige al login conservando la ruta solicitada', () => {
      const resultado = ejecutar(authGuard);

      expect(resultado).toBeInstanceOf(UrlTree);
      expect(String(resultado)).toContain('/login');
      expect((resultado as UrlTree).queryParams['redirect']).toBe('/pedidos');
    });
  });

  describe('roleGuard', () => {
    it('manda al login cuando no hay sesión', () => {
      const resultado = ejecutar(roleGuard, ruta(['admin']));

      expect(resultado).toBeInstanceOf(UrlTree);
      expect(String(resultado)).toBe('/login');
    });

    it('deja pasar cuando el rol coincide', () => {
      auth.autenticado.mockReturnValue(true);
      auth.tieneRol.mockReturnValue(true);

      expect(ejecutar(roleGuard, ruta(['admin', 'ventas']))).toBe(true);
      expect(auth.tieneRol).toHaveBeenCalledWith('admin', 'ventas');
    });

    it('manda al dashboard cuando el rol no coincide', () => {
      auth.autenticado.mockReturnValue(true);

      const resultado = ejecutar(roleGuard, ruta(['admin']));

      expect(resultado).toBeInstanceOf(UrlTree);
      expect(String(resultado)).toBe('/dashboard');
    });

    it('deja pasar si la ruta no exige roles', () => {
      auth.autenticado.mockReturnValue(true);

      expect(ejecutar(roleGuard)).toBe(true);
    });
  });

  describe('publicOnlyGuard', () => {
    it('permite el login sin sesión', () => {
      expect(ejecutar(publicOnlyGuard)).toBe(true);
    });

    it('lleva al dashboard si ya hay sesión', () => {
      auth.autenticado.mockReturnValue(true);

      const resultado = ejecutar(publicOnlyGuard);

      expect(resultado).toBeInstanceOf(UrlTree);
      expect(String(resultado)).toBe('/dashboard');
    });
  });
});
