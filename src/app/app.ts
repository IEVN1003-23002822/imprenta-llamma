import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from './llamma/auth.service';
import { ConfirmacionDialogComponent } from './llamma/confirmacion-dialog.component';
import { SeoService } from './llamma/seo.service';
import { SITE_INFO } from './llamma/site-info';
import { SolicitudesStore } from './llamma/solicitudes.store';
import { UiService } from './llamma/ui.service';

const REFRESCO_MS = 60_000;

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ConfirmacionDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly store = inject(SolicitudesStore);
  readonly ui = inject(UiService);
  readonly site = SITE_INFO;
  readonly anio = new Date().getFullYear();
  readonly menuAbierto = signal(false);
  readonly modulosAbiertos = signal(false);

  /**
   * Visibilidad de módulos en la navegación. Marketing queda oculto por decisión
   * de producto: su componente, su ruta y sus permisos siguen intactos. Cambia
   * el valor a `true` para reactivarlo en el menú.
   */
  readonly modulosVisibles: Readonly<Record<'marketing', boolean>> = { marketing: false };
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private refresco: ReturnType<typeof setInterval> | null = null;

  /** Ruta activa sin query params ni fragmento, para marcar aria-current. */
  readonly urlActual = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => this.limpiarUrl(evento.urlAfterRedirects)),
    ),
    { initialValue: this.limpiarUrl(this.router.url) },
  );

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

    // Al cambiar de ruta se cierran el menú móvil y el desplegable de módulos.
    effect(() => {
      this.urlActual();
      this.menuAbierto.set(false);
      this.modulosAbiertos.set(false);
    });
  }

  ngOnDestroy(): void {
    this.detenerRefresco();
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  alternarModulos(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.modulosAbiertos.update((abierto) => !abierto);
  }

  @HostListener('document:click', ['$event'])
  cerrarModulos(evento: Event): void {
    const objetivo = evento.target as Element | null;
    if (!objetivo?.closest('.dropdown')) this.modulosAbiertos.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.menuAbierto.set(false);
    this.modulosAbiertos.set(false);
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

  esRuta(ruta: string): boolean {
    const actual = this.urlActual();
    return ruta === '/' ? actual === '/' : actual === ruta || actual.startsWith(`${ruta}/`);
  }

  private limpiarUrl(url: string): string {
    return url.split('?')[0].split('#')[0] || '/';
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
