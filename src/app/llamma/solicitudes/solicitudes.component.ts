import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { LlammaService } from '../llamma.service';
import { SolicitudesStore } from '../solicitudes.store';
import {
  ArchivoAdjunto,
  Cotizacion,
  EstadoSolicitud,
  SolicitudCotizacion,
} from '../llamma.models';

interface OpcionEstado {
  clave: string;
  etiqueta: string;
}

const OPCIONES_ESTADO: OpcionEstado[] = [
  { clave: '', etiqueta: 'Todas' },
  { clave: 'nueva', etiqueta: 'Nuevas' },
  { clave: 'en-revision', etiqueta: 'En revisión' },
  { clave: 'cotizada', etiqueta: 'Cotizadas' },
  { clave: 'convertida', etiqueta: 'Convertidas' },
  { clave: 'descartada', etiqueta: 'Descartadas' },
];

@Component({
  selector: 'app-solicitudes',
  imports: [RouterLink],
  templateUrl: './solicitudes.component.html',
  styleUrl: './solicitudes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly store = inject(SolicitudesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly opciones = OPCIONES_ESTADO;

  readonly solicitudes = signal<SolicitudCotizacion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly estadoFiltro = signal('');
  readonly texto = signal('');
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly total = signal(0);

  readonly seleccionada = signal<SolicitudCotizacion | null>(null);
  readonly detalleCargando = signal(false);
  readonly accion = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly cotizacionCreada = signal<Cotizacion | null>(null);
  readonly correoCopiado = signal(false);

  readonly hayFiltros = computed(
    () => this.estadoFiltro() !== '' || this.texto().trim() !== '',
  );

  readonly nuevoConteo = computed(() => this.store.resumen().nuevas);

  ngOnInit(): void {
    this.cargar();
    this.store.cargarResumen();

    const solicitud = Number(this.route.snapshot.queryParamMap.get('solicitud'));
    if (Number.isFinite(solicitud) && solicitud > 0) {
      this.abrir(solicitud);
    }
  }

  cargar(pagina = 1): void {
    this.cargando.set(true);
    this.error.set(null);

    this.service
      .listarSolicitudes({
        estado: this.estadoFiltro() || undefined,
        q: this.texto().trim() || undefined,
        page: pagina,
        perPage: 15,
      })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.solicitudes.set(respuesta.items);
          this.total.set(respuesta.total);
          this.pagina.set(respuesta.pagina);
          this.paginas.set(Math.max(respuesta.paginas, 1));
        },
        error: (respuesta: HttpErrorResponse) => {
          this.error.set(
            respuesta.status === 401
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : 'No pudimos cargar la bandeja de solicitudes.',
          );
        },
      });
  }

  filtrarPor(estado: string): void {
    this.estadoFiltro.set(estado);
    this.cargar(1);
  }

  actualizarTexto(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  buscar(): void {
    this.cargar(1);
  }

  limpiar(): void {
    this.estadoFiltro.set('');
    this.texto.set('');
    this.cargar(1);
  }

  cambiarPagina(delta: number): void {
    const destino = this.pagina() + delta;
    if (destino < 1 || destino > this.paginas() || this.cargando()) return;
    this.cargar(destino);
  }

  abrir(id: number): void {
    this.detalleCargando.set(true);
    this.errorAccion.set(null);
    this.cotizacionCreada.set(null);

    this.service
      .detalleSolicitud(id)
      .pipe(finalize(() => this.detalleCargando.set(false)))
      .subscribe({
        next: (solicitud) => this.seleccionada.set(solicitud),
        error: () => this.errorAccion.set('No pudimos abrir el detalle de la solicitud.'),
      });
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
    this.aviso.set(null);
    this.errorAccion.set(null);
    this.cotizacionCreada.set(null);
    this.correoCopiado.set(false);

    if (this.route.snapshot.queryParamMap.has('solicitud')) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  copiarCorreo(correo: string): void {
    navigator.clipboard?.writeText(correo).then(
      () => {
        this.correoCopiado.set(true);
        setTimeout(() => this.correoCopiado.set(false), 2200);
      },
      () => undefined,
    );
  }

  cambiarEstado(estado: EstadoSolicitud): void {
    const solicitud = this.seleccionada();
    if (!solicitud || solicitud.estado === estado) return;

    this.accion.set('estado');
    this.errorAccion.set(null);

    this.service
      .cambiarEstadoSolicitud(solicitud.id, estado)
      .pipe(finalize(() => this.accion.set(null)))
      .subscribe({
        next: (actualizada) => {
          this.seleccionada.update((actual) =>
            actual ? { ...actual, estado: actualizada.estado } : actual,
          );
          this.aviso.set(`La solicitud ${solicitud.folio} pasó a "${this.etiquetaEstado(estado)}".`);
          this.recargarLista();
        },
        error: () => this.errorAccion.set('No pudimos actualizar el estado de la solicitud.'),
      });
  }

  cotizarConDetalle(): void {
    const solicitud = this.seleccionada();
    if (!solicitud) return;
    this.router.navigate(['/captura'], { queryParams: { solicitud: solicitud.id } });
  }

  convertir(): void {
    const solicitud = this.seleccionada();
    if (!solicitud || this.accion()) return;

    this.accion.set('convertir');
    this.errorAccion.set(null);

    this.service
      .convertirSolicitudACotizacion(solicitud.id, {
        vigenciaDias: 15,
        notas: solicitud.mensaje ?? undefined,
      })
      .pipe(finalize(() => this.accion.set(null)))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacionCreada.set(cotizacion);
          this.seleccionada.update((actual) =>
            actual
              ? { ...actual, estado: 'cotizada', cotizacionId: cotizacion.id }
              : actual,
          );
          this.aviso.set(`Cotización ${cotizacion.folio} creada con el estimado de la solicitud.`);
          this.recargarLista();
        },
        error: (respuesta: HttpErrorResponse) => {
          if (respuesta.status === 409 && respuesta.error?.cotizacion) {
            const existente = respuesta.error.cotizacion as Cotizacion;
            this.cotizacionCreada.set(existente);
            this.errorAccion.set(
              `Esta solicitud ya tenía la cotización ${existente.folio}. Puedes abrirla en el cotizador.`,
            );
            this.recargarLista();
            return;
          }
          this.errorAccion.set(
            respuesta.error?.error || 'No pudimos convertir la solicitud en cotización.',
          );
        },
      });
  }

  abrirCotizacion(cotizacion: { id: number | null | undefined }): void {
    if (!cotizacion.id) return;
    this.router.navigate(['/captura'], { queryParams: { cotizacion: cotizacion.id } });
  }

  descargar(archivo: ArchivoAdjunto): void {
    this.accion.set(`archivo-${archivo.id}`);
    this.service
      .descargarArchivo(archivo.id)
      .pipe(finalize(() => this.accion.set(null)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = archivo.nombreOriginal;
          enlace.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.errorAccion.set('No pudimos descargar el archivo adjunto.'),
      });
  }

  whatsapp(telefono: string | null | undefined): string {
    const digitos = (telefono ?? '').replace(/\D/g, '');
    return digitos ? `https://wa.me/52${digitos}` : '';
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor ?? 0);
  }

  fecha(valor: string | null | undefined): string {
    if (!valor) return 'Sin fecha';
    const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  fechaHora(valor: string | null | undefined): string {
    if (!valor) return '—';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  iniciales(nombre: string | null | undefined): string {
    return (nombre ?? 'LL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase();
  }

  tamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  etiquetaEstado(estado: EstadoSolicitud): string {
    const etiquetas: Record<EstadoSolicitud, string> = {
      nueva: 'Nueva',
      'en-revision': 'En revisión',
      cotizada: 'Cotizada',
      convertida: 'Convertida',
      descartada: 'Descartada',
    };
    return etiquetas[estado];
  }

  claseEstado(estado: EstadoSolicitud): string {
    const clases: Record<EstadoSolicitud, string> = {
      nueva: 'badge-soft-cyan',
      'en-revision': 'badge-soft-warning',
      cotizada: 'badge-soft-magenta',
      convertida: 'badge-soft-success',
      descartada: 'badge-soft-muted',
    };
    return clases[estado];
  }

  private recargarLista(): void {
    this.cargar(this.pagina());
    this.store.cargarResumen();
  }
}
