import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './llamma/auth.service';
import { SolicitudesStore } from './llamma/solicitudes.store';
import { UiService } from './llamma/ui.service';

const REFRESCO_MS = 60_000;

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly store = inject(SolicitudesStore);
  readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private refresco: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.auth.autenticado()) {
        this.store.cargarResumen();
        this.iniciarRefresco();
      } else {
        this.store.reiniciar();
        this.detenerRefresco();
      }
    });
  }

  ngOnDestroy(): void {
    this.detenerRefresco();
  }

  get iniciales(): string {
    return (this.auth.nombre() || 'LL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase();
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.store.reiniciar();
    this.router.navigateByUrl('/');
  }

  private iniciarRefresco(): void {
    if (this.refresco !== null) return;
    this.refresco = setInterval(() => this.store.cargarResumen(), REFRESCO_MS);
  }

  private detenerRefresco(): void {
    if (this.refresco === null) return;
    clearInterval(this.refresco);
    this.refresco = null;
  }
}
