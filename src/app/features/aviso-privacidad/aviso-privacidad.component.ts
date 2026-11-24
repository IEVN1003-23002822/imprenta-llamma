import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SITE_INFO } from '../../core/config/site-info';

@Component({
  selector: 'app-aviso-privacidad',
  imports: [RouterLink],
  templateUrl: './aviso-privacidad.component.html',
  styleUrl: './aviso-privacidad.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoPrivacidadComponent {
  readonly site = SITE_INFO;
  readonly actualizado = 'Noviembre de 2026';
  readonly anio = new Date().getFullYear();
}
