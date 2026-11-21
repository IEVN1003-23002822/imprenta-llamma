import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface PasoCotizar {
  numero: number;
  titulo: string;
  detalle: string;
}

/** Stepper del cotizador y aviso de borrador recuperado. */
@Component({
  selector: 'app-cotizar-pasos',
  templateUrl: './cotizar-pasos.component.html',
  styleUrl: './cotizar-pasos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarPasosComponent {
  readonly paso = input.required<number>();
  readonly pasos = input.required<readonly PasoCotizar[]>();
  readonly borradorRecuperado = input(false);
  readonly archivosPendientes = input<string[]>([]);

  readonly ir = output<number>();
  readonly ocultarAviso = output<void>();
  readonly descartar = output<void>();
}
