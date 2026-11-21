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
  private silencioHasta = 0;

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
    if (Date.now() < this.silencioHasta) return;
    this.mostrar(mensaje, 'error', 6000);
  }

  /**
   * Evita toasts de error duplicados mientras la app redirige al login por
   * una sesión vencida (los componentes fallidos alcanzan a suscribirse).
   */
  silenciarErrores(duracionMs = 2500): void {
    this.silencioHasta = Date.now() + duracionMs;
  }

  info(mensaje: string): void {
    this.mostrar(mensaje, 'info');
  }

  cerrar(id: number): void {
    this._toasts.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  /** Extrae un mensaje legible de una respuesta de error HTTP. */
  mensajeDeError(error: unknown, respaldo = 'No pudimos completar la operación.'): string {
    const respuesta = error as {
      status?: number;
      error?: { error?: string };
    } | null;

    if (respuesta?.status === 0) {
      return 'Sin conexión. Revisa tu red e intenta de nuevo.';
    }
    if (respuesta?.status === 408 || respuesta?.status === 504) {
      return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
    }
    if ((respuesta?.status ?? 0) >= 500) {
      return 'Tuvimos un problema temporal. Intenta de nuevo en unos minutos.';
    }
    return respuesta?.error?.error || respaldo;
  }
}
