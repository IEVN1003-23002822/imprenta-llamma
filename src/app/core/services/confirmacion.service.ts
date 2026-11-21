import { Injectable, computed, signal } from '@angular/core';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  confirmar?: string;
  cancelar?: string;
  /** Pinta el botón principal como acción destructiva. */
  peligro?: boolean;
}

interface SolicitudConfirmacion {
  opciones: OpcionesConfirmacion;
  resolver: (valor: boolean) => void;
}

/**
 * Sustituye a `window.confirm` con un diálogo propio, accesible y con el
 * lenguaje visual de Llamma. Devuelve una promesa que resuelve `true` solo
 * cuando la persona confirma la acción.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  private readonly _solicitud = signal<SolicitudConfirmacion | null>(null);

  readonly actual = computed(() => this._solicitud()?.opciones ?? null);

  confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
    // Si ya había una confirmación pendiente, se cancela antes de abrir otra.
    this._solicitud()?.resolver(false);

    return new Promise<boolean>((resolver) => {
      this._solicitud.set({ opciones, resolver });
    });
  }

  responder(valor: boolean): void {
    const solicitud = this._solicitud();
    if (!solicitud) return;
    this._solicitud.set(null);
    solicitud.resolver(valor);
  }
}
