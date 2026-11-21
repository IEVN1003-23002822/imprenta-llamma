import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfirmacionService, OpcionesConfirmacion } from './confirmacion.service';

describe('ConfirmacionService', () => {
  const opciones: OpcionesConfirmacion = {
    titulo: 'Eliminar producto',
    mensaje: 'Esta acción no se puede deshacer.',
    confirmar: 'Eliminar',
    peligro: true,
  };

  let servicio: ConfirmacionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(ConfirmacionService);
  });

  it('arranca sin diálogo pendiente', () => {
    expect(servicio.actual()).toBeNull();
  });

  it('expone las opciones mientras espera respuesta', () => {
    void servicio.confirmar(opciones);

    expect(servicio.actual()).toEqual(opciones);
  });

  it('resuelve true al confirmar y cierra el diálogo', async () => {
    const respuesta = servicio.confirmar(opciones);

    servicio.responder(true);

    await expect(respuesta).resolves.toBe(true);
    expect(servicio.actual()).toBeNull();
  });

  it('resuelve false al cancelar', async () => {
    const respuesta = servicio.confirmar(opciones);

    servicio.responder(false);

    await expect(respuesta).resolves.toBe(false);
    expect(servicio.actual()).toBeNull();
  });

  it('cancela la solicitud anterior cuando llega otra confirmación', async () => {
    const primera = servicio.confirmar(opciones);
    const segunda = servicio.confirmar({ titulo: 'Publicar', mensaje: '¿Publicar ahora?' });

    await expect(primera).resolves.toBe(false);
    expect(servicio.actual()?.titulo).toBe('Publicar');

    servicio.responder(true);
    await expect(segunda).resolves.toBe(true);
  });

  it('ignora una respuesta cuando no hay diálogo abierto', () => {
    expect(() => servicio.responder(true)).not.toThrow();
    expect(servicio.actual()).toBeNull();
  });
});
