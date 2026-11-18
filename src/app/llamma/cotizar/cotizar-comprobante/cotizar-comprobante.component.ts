import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ItemSolicitud, SolicitudCotizacion } from '../../llamma.models';

/** Confirmación posterior al envío de una solicitud de cotización. */
@Component({
  selector: 'app-cotizar-comprobante',
  imports: [RouterLink],
  templateUrl: './cotizar-comprobante.component.html',
  styleUrl: './cotizar-comprobante.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarComprobanteComponent {
  readonly folio = input.required<string>();
  readonly solicitud = input<SolicitudCotizacion | null>(null);
  readonly partidas = input<ItemSolicitud[]>([]);
  readonly totalPiezas = input(0);
  readonly totalConIva = input(0);
  readonly correo = input('');
  readonly copiado = input(false);

  readonly copiar = output<void>();
  readonly descargar = output<void>();
  readonly nueva = output<void>();

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  fecha(valor: string | null | undefined): string {
    if (!valor) return 'Por confirmar';
    const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
