import { describe, expect, it } from 'vitest';

import {
  badgeDe,
  COMPRAS_ABIERTAS,
  ESTADOS_PEDIDO,
  ESTADOS_SOLICITUD,
  etiquetaDe,
  ETAPAS_PRODUCCION,
  iconoDe,
  mapaCortas,
  mapaEtiquetas,
  mapaIconos,
  SEGMENTOS_CLIENTE,
  UNIDADES,
} from './estados';

describe('estados compartidos', () => {
  const listas = {
    ESTADOS_SOLICITUD,
    ESTADOS_PEDIDO,
    ETAPAS_PRODUCCION,
    SEGMENTOS_CLIENTE,
    UNIDADES,
  };

  it('no repite valores dentro de una misma lista', () => {
    for (const [nombre, lista] of Object.entries(listas)) {
      const valores = lista.map((opcion) => opcion.valor);
      expect(new Set(valores).size, `${nombre} tiene valores repetidos`).toBe(valores.length);
    }
  });

  it('todas las opciones tienen etiqueta legible', () => {
    for (const [nombre, lista] of Object.entries(listas)) {
      for (const opcion of lista) {
        expect(opcion.etiqueta.trim(), `${nombre}.${opcion.valor}`).not.toBe('');
      }
    }
  });

  it('mantiene la etapa «diseno» con la etiqueta «Diseño»', () => {
    expect(etiquetaDe(ETAPAS_PRODUCCION, 'diseno')).toBe('Diseño');
  });

  it('deja «pieza» como primera unidad para capturar existencias', () => {
    expect(UNIDADES[0].valor).toBe('pieza');
    expect(mapaCortas(UNIDADES)['pieza']).toBe('pza');
  });

  it('resuelve etiquetas, badges e iconos con respaldo', () => {
    expect(etiquetaDe(ESTADOS_PEDIDO, 'en-produccion')).toBe('En producción');
    expect(badgeDe(ESTADOS_PEDIDO, 'entregado')).toBe('badge-soft-success');
    expect(badgeDe(ESTADOS_PEDIDO, 'inexistente')).toBe('badge-soft-muted');
    expect(iconoDe(ETAPAS_PRODUCCION, 'impresion')).toBe('bi-printer');
    expect(iconoDe(ETAPAS_PRODUCCION, 'inexistente')).toBe('bi-circle');
    expect(etiquetaDe(ESTADOS_PEDIDO, null)).toBe('');
    expect(badgeDe(ESTADOS_PEDIDO, undefined, 'badge-propio')).toBe('badge-propio');
  });

  it('genera mapas para plantillas sin incluir opciones sin icono ni unidad corta', () => {
    expect(mapaEtiquetas(ESTADOS_SOLICITUD)['en-revision']).toBe('En revisión');
    expect(mapaIconos(ETAPAS_PRODUCCION)['corte']).toBe('bi-scissors');
    expect(mapaCortas(UNIDADES)).not.toHaveProperty('m2x');
  });

  it('considera abiertas solo las compras que aún no llegan a bodega', () => {
    expect([...COMPRAS_ABIERTAS].sort()).toEqual(['confirmada', 'en-transito', 'pendiente']);
    expect(COMPRAS_ABIERTAS.has('recibida')).toBe(false);
  });
});
