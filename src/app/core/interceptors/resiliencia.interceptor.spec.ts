import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TimeoutError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resilienciaInterceptor } from './resiliencia.interceptor';

describe('resilienciaInterceptor', () => {
  let http: HttpClient;
  let control: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([resilienciaInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    control = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reintenta una vez un GET tras un fallo 5xx y entrega la respuesta buena', async () => {
    vi.useFakeTimers();
    const resultado: unknown[] = [];
    const fallos: unknown[] = [];

    http.get('/api/pedidos').subscribe({
      next: (valor) => resultado.push(valor),
      error: (error) => fallos.push(error),
    });

    control.expectOne('/api/pedidos').flush({}, { status: 500, statusText: 'Error interno' });
    await vi.advanceTimersByTimeAsync(500);

    control.expectOne('/api/pedidos').flush({ items: [], total: 0 });

    expect(resultado).toEqual([{ items: [], total: 0 }]);
    expect(fallos).toHaveLength(0);
  });

  it('reintenta un GET ante un fallo de red (status 0)', async () => {
    vi.useFakeTimers();
    let completado = false;

    http.get('/api/public/productos').subscribe({ complete: () => (completado = true) });

    control
      .expectOne('/api/public/productos')
      .flush(null, { status: 0, statusText: 'Error de red' });
    await vi.advanceTimersByTimeAsync(500);

    control.expectOne('/api/public/productos').flush({ items: [], total: 0 });

    expect(completado).toBe(true);
  });

  it('solo reintenta una vez: el segundo fallo se propaga', async () => {
    vi.useFakeTimers();
    const fallos: number[] = [];

    http.get('/api/pedidos').subscribe({ error: (error) => fallos.push(error.status) });

    control.expectOne('/api/pedidos').flush({}, { status: 500, statusText: 'Error interno' });
    await vi.advanceTimersByTimeAsync(500);
    control.expectOne('/api/pedidos').flush({}, { status: 503, statusText: 'No disponible' });

    expect(fallos).toEqual([503]);
    control.verify();
  });

  it('no reintenta un POST aunque falle con 5xx', () => {
    const fallos: number[] = [];

    http.post('/api/pedidos', {}).subscribe({ error: (error) => fallos.push(error.status) });

    control.expectOne('/api/pedidos').flush({}, { status: 500, statusText: 'Error interno' });

    expect(fallos).toEqual([500]);
    control.verify();
  });

  it('no reintenta los errores 4xx', () => {
    const fallos: number[] = [];

    http.get('/api/pedidos').subscribe({ error: (error) => fallos.push(error.status) });

    control.expectOne('/api/pedidos').flush({}, { status: 404, statusText: 'No encontrado' });

    expect(fallos).toEqual([404]);
    control.verify();
  });

  it('corta una petición que tarda más de 20 segundos', async () => {
    vi.useFakeTimers();
    const fallos: unknown[] = [];

    http.get('/api/pedidos').subscribe({ error: (error) => fallos.push(error) });

    await vi.advanceTimersByTimeAsync(20_001);

    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toBeInstanceOf(TimeoutError);
  });
});
