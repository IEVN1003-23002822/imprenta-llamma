import { Injectable, inject, signal } from '@angular/core';

import { LlammaService } from './llamma.service';
import { ResumenSolicitudes } from '../models/llamma.models';

const RESUMEN_INICIAL: ResumenSolicitudes = {
  total: 0,
  porEstado: {
    nueva: 0,
    'en-revision': 0,
    cotizada: 0,
    convertida: 0,
    descartada: 0,
  },
  nuevas: 0,
  enRevision: 0,
};

/** Contador compartido de solicitudes para el badge de la barra interna. */
@Injectable({ providedIn: 'root' })
export class SolicitudesStore {
  private readonly service = inject(LlammaService);

  readonly resumen = signal<ResumenSolicitudes>(RESUMEN_INICIAL);
  readonly cargando = signal(false);

  cargarResumen(): void {
    this.cargando.set(true);
    this.service.resumenSolicitudes().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  reiniciar(): void {
    this.resumen.set(RESUMEN_INICIAL);
  }
}
