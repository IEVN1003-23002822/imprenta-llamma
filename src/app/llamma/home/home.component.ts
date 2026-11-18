import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PORTAFOLIO, TESTIMONIOS } from '../site-info';
import { HomeDetalleComponent } from './home-detalle.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, HomeDetalleComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly portafolio = PORTAFOLIO;
  readonly testimonios = TESTIMONIOS;
}
