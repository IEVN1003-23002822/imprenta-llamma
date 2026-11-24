import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { UiService } from '../services/ui.service';

describe('authInterceptor', () => {
  const auth = {
    token: 'token-1' as string | null,
    expirarSesion: vi.fn(() => true),
  };
  const ui = { silenciarErrores: vi.fn() };

  let http: HttpClient;
  let control: HttpTestingController;

  beforeEach(() => {
    auth.token = 'token-1';
    auth.expirarSesion.mockClear();
    ui.silenciarErrores.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: UiService, useValue: ui },
      ],
    });

    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
  });

  it('añade el token a las llamadas internas', () => {
    http.get('/api/pedidos').subscribe();

    const peticion = control.expectOne('/api/pedidos');
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-1');
    peticion.flush({ items: [], total: 0 });
  });

  it('no añade el token a las rutas públicas ni al login', () => {
    http.get('/api/public/productos').subscribe();
    http.post('/api/auth/login', {}).subscribe();

    expect(control.expectOne('/api/public/productos').request.headers.has('Authorization')).toBe(
      false,
    );
    expect(control.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
  });

  it('omite la cabecera cuando no hay sesión', () => {
    auth.token = null;
    http.get('/api/pedidos').subscribe();

    const peticion = control.expectOne('/api/pedidos');
    expect(peticion.request.headers.has('Authorization')).toBe(false);
    peticion.flush({});
  });

  it('ante un 401 silencia los errores, cierra la sesión y propaga el fallo', () => {
    const error = vi.fn();
    http.get('/api/pedidos').subscribe({ error });

    control.expectOne('/api/pedidos').flush({}, { status: 401, statusText: 'No autorizado' });

    expect(ui.silenciarErrores).toHaveBeenCalledTimes(1);
    expect(auth.expirarSesion).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0].status).toBe(401);
  });

  it('no cierra la sesión si un 401 llega desde una ruta pública', () => {
    const error = vi.fn();
    http.get('/api/public/solicitudes/SOL-1').subscribe({ error });

    control
      .expectOne('/api/public/solicitudes/SOL-1')
      .flush({}, { status: 401, statusText: 'No autorizado' });

    expect(ui.silenciarErrores).not.toHaveBeenCalled();
    expect(auth.expirarSesion).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('deja pasar otros errores sin tocar la sesión', () => {
    const error = vi.fn();
    http.get('/api/pedidos').subscribe({ error });

    control.expectOne('/api/pedidos').flush({}, { status: 500, statusText: 'Error interno' });

    expect(ui.silenciarErrores).not.toHaveBeenCalled();
    expect(auth.expirarSesion).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
