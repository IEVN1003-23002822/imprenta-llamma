import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmacionService } from '../core/services/confirmacion.service';
import { ModalAccesibleDirective } from './modal-accesible.directive';

@Component({
  selector: 'app-confirmacion-dialog',
  imports: [ModalAccesibleDirective],
  templateUrl: './confirmacion-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmacionDialogComponent {
  readonly confirmacion = inject(ConfirmacionService);
}
