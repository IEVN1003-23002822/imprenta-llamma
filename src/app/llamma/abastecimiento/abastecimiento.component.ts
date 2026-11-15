import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-abastecimiento',
  imports: [RouterLink],
  templateUrl: './abastecimiento.component.html',
  styleUrl: './abastecimiento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbastecimientoComponent {}
