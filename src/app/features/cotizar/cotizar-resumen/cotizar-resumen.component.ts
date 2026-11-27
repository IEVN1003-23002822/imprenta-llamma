import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ItemSolicitud } from '../../../core/models/llamma.models';
import { redondearMoneda } from '../../../core/utils/precios';

/** Resumen lateral del cotizador con totales y acción de envío. */
@Component({
  selector: 'app-cotizar-resumen',
  templateUrl: './cotizar-resumen.component.html',
  styleUrl: './cotizar-resumen.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarResumenComponent {
  readonly carrito = input<ItemSolicitud[]>([]);
  readonly totalPiezas = input(0);
  readonly totalEstimado = input(0);
  readonly ivaEstimado = input(0);
  readonly totalConIva = input(0);
  readonly error = input<string | null>(null);
  readonly enviando = input(false);

  readonly descuentoMayoreo = computed(() =>
    redondearMoneda(
      this.carrito().reduce((total, item) => total + Number(item.descuentoMayoreo ?? 0), 0),
    ),
  );

  readonly subtotalSinMayoreo = computed(() =>
    redondearMoneda(this.totalEstimado() + this.descuentoMayoreo()),
  );

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }
}
