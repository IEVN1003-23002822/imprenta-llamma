import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Secciones bajas de la portada (materias primas y proceso).
 *
 * Viven en su propio componente para que `@defer` las cargue cuando se
 * acercan al viewport y el chunk inicial de la portada sea más pequeño.
 */
@Component({
  selector: 'app-home-detalle',
  imports: [RouterLink],
  templateUrl: './home-detalle.component.html',
  styleUrl: './home-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeDetalleComponent {}
