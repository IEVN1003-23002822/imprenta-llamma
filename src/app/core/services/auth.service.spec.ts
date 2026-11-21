import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import type { AuthSession, RespuestaLogin } from '../models/llamma.models';

const CLAVE = 'llamma.session.v1';

function crearSesion(expiraEn?: string): AuthSession {
  return {
    usuario: {
      id: 1,
      nombre: 'Ana Admin',
      correo: 'ana@llamma.mx',
      rol: 'admin',
      activo: true,
    },
    token: 'token-1',
    permisos: ['pedidos.ver', 'pedidos.editar'],
    ...(expiraEn ? { expiraEn } : {}),
  };
}

function crearRespuesta(expiraEn = new Date(Date.now() + 3_600_000).toISOString()): RespuestaLogin {
  return {
    token: 'token-1',
    tokenType: 'Bearer',
    expiraEn,
    usuario: crearSesion().usuario,
    permisos: ['pedidos.ver', 'pedidos.editar'],
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: Router;

  /** Crea un injector nuevo; así el servicio vuelve a leer el almacenamiento. */
  function configurar(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    configurar();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('inicia sin sesión', () => {
    expect(service.autenticado()).toBe(false);
    expect(service.token).toBeNull();
    expect(service.usuario()).toBeNull();
  });

  it('guarda la sesión en localStorage al iniciar sesión con «Recordarme»', () => {
    const respuesta = crearRespuesta();
    let recibida: RespuestaLogin | undefined;

    service.login('ana@llamma.mx', 'secreta').subscribe((valor) => (recibida = valor));

    const peticion = http.expectOne('/api/auth/login');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ correo: 'ana@llamma.mx', password: 'secreta' });
    peticion.flush(respuesta);

    expect(recibida).toEqual(respuesta);
    expect(service.autenticado()).toBe(true);
    expect(service.token).toBe('token-1');
    expect(service.tieneRol('admin')).toBe(true);
    expect(service.tienePermiso('pedidos.ver')).toBe(true);
    expect(JSON.parse(localStorage.getItem(CLAVE) ?? '{}')).toMatchObject({ token: 'token-1' });
    expect(sessionStorage.getItem(CLAVE)).toBeNull();
  });

  it('usa sessionStorage cuando no se marca «Recordarme»', () => {
    service.login('ana@llamma.mx', 'secreta', false).subscribe();
    http.expectOne('/api/auth/login').flush(crearRespuesta());

    expect(sessionStorage.getItem(CLAVE)).not.toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('limpia el almacén anterior al guardar una sesión nueva', () => {
    service.guardarSesion(crearSesion(), true);
    service.guardarSesion({ ...crearSesion(), token: 'token-2' }, false);

    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}')).toMatchObject({ token: 'token-2' });
  });

  it('no considera vigente una sesión vencida', () => {
    service.guardarSesion(crearSesion(new Date(Date.now() - 1000).toISOString()));

    expect(service.autenticado()).toBe(false);
  });

  it('carga una sesión vigente desde el almacenamiento al arrancar', () => {
    localStorage.setItem(CLAVE, JSON.stringify(crearSesion()));

    TestBed.resetTestingModule();
    configurar();

    expect(service.autenticado()).toBe(true);
    expect(service.nombre()).toBe('Ana Admin');
  });

  it('descarta al arrancar una sesión vencida guardada', () => {
    localStorage.setItem(
      CLAVE,
      JSON.stringify(crearSesion(new Date(Date.now() - 1000).toISOString())),
    );

    TestBed.resetTestingModule();
    configurar();

    expect(service.autenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('expirarSesion devuelve false cuando no había sesión', () => {
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(service.expirarSesion()).toBe(false);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('expirarSesion limpia la sesión y redirige al login', () => {
    service.guardarSesion(crearSesion());
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    expect(service.expirarSesion()).toBe(true);

    expect(service.autenticado()).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(navegar).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ expirada: '1' }),
      }),
    );
  });

  it('cerrar sesión manualmente no redirige', () => {
    service.guardarSesion(crearSesion());
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    service.limpiarSesion();

    expect(service.autenticado()).toBe(false);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('logout avisa a la API y limpia aunque falle la red', () => {
    http.expectNone('/api/auth/logout');
    service.guardarSesion(crearSesion());

    service.logout();

    const peticion = http.expectOne('/api/auth/logout');
    peticion.flush(null, { status: 0, statusText: 'Error de red' });

    expect(service.autenticado()).toBe(false);
    expect(service.token).toBeNull();
  });
});
