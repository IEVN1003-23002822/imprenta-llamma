import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UiService } from './ui.service';

describe('UiService', () => {
  let servicio: UiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(UiService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra un toast de éxito', () => {
    servicio.exito('Pedido guardado');

    expect(servicio.toasts()).toEqual([{ id: 1, tipo: 'success', mensaje: 'Pedido guardado' }]);
  });

  it('muestra toasts de error e info con su tipo', () => {
    servicio.error('Algo falló');
    servicio.info('Sin cambios');

    expect(servicio.toasts().map((toast) => toast.tipo)).toEqual(['error', 'info']);
  });

  it('cierra el toast al cumplirse su duración', () => {
    servicio.exito('Guardado');
    servicio.mostrar('Nota breve', 'info', 1000);

    vi.advanceTimersByTime(1000);

    expect(servicio.toasts().map((toast) => toast.mensaje)).toEqual(['Guardado']);
  });

  it('no programa cierre cuando la duración es cero', () => {
    servicio.mostrar('Fijo', 'info', 0);

    vi.advanceTimersByTime(60_000);

    expect(servicio.toasts()).toHaveLength(1);
  });

  it('conserva como máximo cuatro toasts visibles', () => {
    for (let indice = 1; indice <= 6; indice += 1) {
      servicio.mostrar(`Aviso ${indice}`, 'info', 0);
    }

    expect(servicio.toasts().map((toast) => toast.mensaje)).toEqual([
      'Aviso 3',
      'Aviso 4',
      'Aviso 5',
      'Aviso 6',
    ]);
  });

  it('cerrar elimina solo el toast indicado', () => {
    servicio.mostrar('Uno', 'info', 0);
    servicio.mostrar('Dos', 'info', 0);

    servicio.cerrar(1);

    expect(servicio.toasts().map((toast) => toast.mensaje)).toEqual(['Dos']);
  });

  it('silenciarErrores bloquea los toasts de error mientras dura', () => {
    servicio.silenciarErrores(2500);

    servicio.error('Sesión vencida');
    expect(servicio.toasts()).toHaveLength(0);

    vi.advanceTimersByTime(2501);
    servicio.error('Fallo real');

    expect(servicio.toasts().map((toast) => toast.mensaje)).toEqual(['Fallo real']);
  });

  it('traduce los fallos de red, de tiempo y 5xx a mensajes claros', () => {
    expect(servicio.mensajeDeError({ status: 0 })).toContain('Sin conexión');
    expect(servicio.mensajeDeError({ status: 408 })).toContain('tardó demasiado');
    expect(servicio.mensajeDeError({ status: 504 })).toContain('tardó demasiado');
    expect(servicio.mensajeDeError({ status: 502 })).toContain('problema temporal');
  });

  it('prefiere el mensaje de la API y cae al respaldo', () => {
    expect(servicio.mensajeDeError({ status: 409, error: { error: 'Folio repetido' } })).toBe(
      'Folio repetido',
    );
    expect(servicio.mensajeDeError({ status: 409 }, 'No se pudo guardar.')).toBe(
      'No se pudo guardar.',
    );
    expect(servicio.mensajeDeError(null)).toBe('No pudimos completar la operación.');
  });
});
