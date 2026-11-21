import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let contador = 0;
let modalesAbiertos = 0;

/**
 * Accesibilidad compartida para los modales del ERP.
 *
 * - Marca el contenedor como `role="dialog"` + `aria-modal` y lo asocia al título
 *   visible (`aria-labelledby`) cuando no se indica otra etiqueta.
 * - Mueve el foco al primer control, atrapa el tabulador dentro del diálogo,
 *   cierra con `Escape` (emitiendo `cerrar`) y devuelve el foco al disparador.
 * - Bloquea el scroll del documento mientras el modal está abierto.
 *
 * Uso: `<div class="modal fade show d-block" appModalAccesible (cerrar)="cerrarX()">`.
 */
@Directive({
  selector: '[appModalAccesible]',
})
export class ModalAccesibleDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly id = `modal-accesible-${++contador}`;

  @Output() readonly cerrar = new EventEmitter<void>();

  private focoPrevio: HTMLElement | null = null;
  private abierto = false;

  ngAfterViewInit(): void {
    const modal = this.host.nativeElement;
    this.focoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
      const titulo = modal.querySelector<HTMLElement>('.modal-title');
      if (titulo) {
        if (!titulo.id) titulo.id = `${this.id}-titulo`;
        modal.setAttribute('aria-labelledby', titulo.id);
      }
    }

    document.body.classList.add('modal-abierto');
    modalesAbiertos += 1;
    this.abierto = true;

    // Espera un ciclo para que los controles internos existan y sean visibles.
    setTimeout(() => this.enfocarInicial());
  }

  ngOnDestroy(): void {
    if (!this.abierto) return;
    this.abierto = false;
    modalesAbiertos = Math.max(0, modalesAbiertos - 1);
    if (modalesAbiertos === 0) {
      document.body.classList.remove('modal-abierto');
    }

    const previo = this.focoPrevio;
    if (previo && document.contains(previo)) {
      setTimeout(() => previo.focus());
    }
  }

  @HostListener('keydown', ['$event'])
  manejarTeclado(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      this.cerrar.emit();
      return;
    }

    if (evento.key !== 'Tab') return;

    const enfocables = this.enfocables();
    if (!enfocables.length) {
      evento.preventDefault();
      this.host.nativeElement.focus();
      return;
    }

    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement as HTMLElement | null;

    if (evento.shiftKey && (activo === primero || !this.host.nativeElement.contains(activo))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (
      !evento.shiftKey &&
      (activo === ultimo || !this.host.nativeElement.contains(activo))
    ) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
      (elemento) =>
        !elemento.hasAttribute('hidden') &&
        elemento.getAttribute('aria-hidden') !== 'true' &&
        elemento.offsetParent !== null,
    );
  }

  private enfocarInicial(): void {
    const modal = this.host.nativeElement;
    if (!document.contains(modal)) return;

    const cuerpo = modal.querySelector<HTMLElement>('.modal-body');
    const candidatos = cuerpo
      ? Array.from(cuerpo.querySelectorAll<HTMLElement>(ENFOCABLES))
      : this.enfocables();
    const primero =
      candidatos.find(
        (elemento) =>
          !elemento.hasAttribute('hidden') &&
          elemento.getAttribute('aria-hidden') !== 'true' &&
          elemento.offsetParent !== null,
      ) ?? this.enfocables()[0];

    if (primero) {
      primero.focus();
      return;
    }

    modal.setAttribute('tabindex', '-1');
    modal.focus();
  }
}
