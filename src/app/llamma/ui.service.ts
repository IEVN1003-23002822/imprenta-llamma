import { Injectable, signal } from '@angular/core';

export type TipoToast = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

/**
 * Notificaciones ligeras compartidas por todos los módulos.
 *
 * Se muestran en la esquina inferior derecha y desaparecen solas; el
 * identificador permite cerrarlas manualmente sin afectar a las demás.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private contador = 0;

  mostrar(mensaje: string, tipo: TipoToast = 'success', duracionMs = 4200): void {
    const id = ++this.contador;
    this._toasts.update((lista) => [...lista.slice(-3), { id, tipo, mensaje }]);
    if (duracionMs > 0) {
      setTimeout(() => this.cerrar(id), duracionMs);
    }
  }

  exito(mensaje: string): void {
    this.mostrar(mensaje, 'success');
  }

  error(mensaje: string): void {
    this.mostrar(mensaje, 'error', 6000);
  }

  info(mensaje: string): void {
    this.mostrar(mensaje, 'info');
  }

  cerrar(id: number): void {
    this._toasts.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  /** Extrae un mensaje legible de una respuesta de error HTTP. */
  mensajeDeError(error: unknown, respaldo = 'No pudimos completar la operación.'): string {
    const respuesta = error as { error?: { error?: string }; message?: string } | null;
    return respuesta?.error?.error || respuesta?.message || respaldo;
  }
}
