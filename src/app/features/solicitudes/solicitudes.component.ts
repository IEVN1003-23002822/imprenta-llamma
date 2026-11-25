import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  ESTADOS_SOLICITUD,
  EXTENSIONES_ARCHIVO,
  MAX_BYTES_ARCHIVO,
  badgeDe,
  etiquetaDe,
} from '../../core/models/estados';
import { AuthService } from '../../core/services/auth.service';
import { LlammaService } from '../../core/services/llamma.service';
import { SolicitudesStore } from '../../core/services/solicitudes.store';
import {
  ArchivoAdjunto,
  Cotizacion,
  EstadoSolicitud,
  MensajeChat,
  SolicitudCotizacion,
} from '../../core/models/llamma.models';

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  ...ESTADOS_SOLICITUD.map((estado) => ({
    valor: estado.valor,
    etiqueta: estado.plural ?? estado.etiqueta,
  })),
];

@Component({
  selector: 'app-solicitudes',
  imports: [RouterLink],
  templateUrl: './solicitudes.component.html',
  styleUrl: './solicitudes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitudesComponent implements OnInit, OnDestroy {
  private readonly service = inject(LlammaService);
  private readonly store = inject(SolicitudesStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private scrollBloqueado = false;
  private readonly alRedimensionar = (): void => {
    if (!window.matchMedia('(max-width: 1199.98px)').matches) {
      this.liberarScroll();
    }
  };

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

  /** La solicitud llegó solo con mensaje: no hay partidas para estimar. */
  readonly sinPartidas = computed(
    () => !!this.seleccionada() && (this.seleccionada()?.itemsSolicitados?.length ?? 0) === 0,
  );

  readonly mensajes = signal<MensajeChat[]>([]);
  readonly borradorChat = signal('');
  readonly adjuntoChat = signal<File | null>(null);
  readonly enviandoChat = signal(false);
  readonly errorChat = signal<string | null>(null);
  readonly descargandoAdjunto = signal<number | null>(null);
  readonly mockupUrls = signal<Record<number, string>>({});
  readonly mockupsAdjuntos = computed<ArchivoAdjunto[]>(() =>
    (this.seleccionada()?.archivosAdjuntos ?? []).filter(
      (archivo) => archivo.esMockup || !!archivo.mockupData,
    ),
  );
  private readonly hiloChat = viewChild<ElementRef<HTMLDivElement>>('hiloChat');

  readonly hayFiltros = computed(() => this.estadoFiltro() !== '' || this.texto().trim() !== '');
  readonly puedeGestionar = computed(() => this.auth.puedeEditarVentas());

  readonly nuevoConteo = computed(() => this.store.resumen().nuevas);

  ngOnInit(): void {
    window.addEventListener('resize', this.alRedimensionar);
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
    this.errorChat.set(null);
    this.borradorChat.set('');
    this.adjuntoChat.set(null);
    this.bloquearScroll();

    this.service
      .detalleSolicitud(id)
      .pipe(finalize(() => this.detalleCargando.set(false)))
      .subscribe({
        next: (solicitud) => {
          this.seleccionada.set(solicitud);
          this.mensajes.set(solicitud.mensajes ?? []);
          this.cargarMockups(solicitud.archivosAdjuntos ?? []);
          this.desplazarHilo();
        },
        error: () => {
          this.errorAccion.set('No pudimos abrir el detalle de la solicitud.');
          this.liberarScroll();
        },
      });
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
    this.aviso.set(null);
    this.errorAccion.set(null);
    this.cotizacionCreada.set(null);
    this.correoCopiado.set(false);
    this.mensajes.set([]);
    this.borradorChat.set('');
    this.adjuntoChat.set(null);
    this.errorChat.set(null);
    this.liberarMockupUrls();
    this.liberarScroll();

    if (this.route.snapshot.queryParamMap.has('solicitud')) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.alRedimensionar);
    this.liberarMockupUrls();
    this.liberarScroll();
  }

  private bloquearScroll(): void {
    if (this.scrollBloqueado) return;
    if (!window.matchMedia('(max-width: 1199.98px)').matches) return;
    document.body.style.overflow = 'hidden';
    this.scrollBloqueado = true;
  }

  private liberarScroll(): void {
    if (!this.scrollBloqueado) return;
    document.body.style.overflow = '';
    this.scrollBloqueado = false;
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
          this.aviso.set(
            `La solicitud ${solicitud.folio} pasó a "${this.etiquetaEstado(estado)}".`,
          );
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

    if (this.sinPartidas()) {
      this.errorAccion.set(
        'Esta solicitud llegó solo con mensaje y no tiene partidas que cotizar. Usa «Revisar partidas y precios» para agregarlas.',
      );
      return;
    }

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
            actual ? { ...actual, estado: 'cotizada', cotizacionId: cotizacion.id } : actual,
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
            respuesta.error?.mensaje ||
              respuesta.error?.error ||
              'No pudimos convertir la solicitud en cotización.',
          );
        },
      });
  }

  abrirCotizacion(cotizacion: { id: number | null | undefined }): void {
    if (!cotizacion.id) return;
    this.router.navigate(['/captura'], { queryParams: { cotizacion: cotizacion.id } });
  }

  /** Carga como blob las capturas de mockup porque el endpoint exige token. */
  private cargarMockups(archivos: ArchivoAdjunto[]): void {
    this.liberarMockupUrls();
    for (const archivo of archivos) {
      if (!archivo.esMockup && !archivo.mockupData) continue;
      this.service.descargarArchivo(archivo.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.mockupUrls.update((actual) => ({ ...actual, [archivo.id]: url }));
        },
        error: () => undefined,
      });
    }
  }

  private liberarMockupUrls(): void {
    Object.values(this.mockupUrls()).forEach((url) => URL.revokeObjectURL(url));
    this.mockupUrls.set({});
  }

  resumenMockup(archivo: ArchivoAdjunto): string {
    const datos = archivo.mockupData;
    if (!datos) return 'Previsualización del diseño';
    const partes = [datos.vista === '3d' ? 'Vista 3D' : 'Vista 2D'];
    if (datos.material) partes.push(datos.material === 'vinil' ? 'Vinil' : 'Lona');
    if (datos.medidas) partes.push(`${datos.medidas.ancho} × ${datos.medidas.alto} m`);
    if (datos.capas?.length) partes.push(`${datos.capas.length} elemento(s)`);
    return partes.join(' · ');
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

  actualizarBorradorChat(evento: Event): void {
    this.borradorChat.set((evento.target as HTMLTextAreaElement).value);
  }

  seleccionarAdjuntoChat(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';

    if (!archivo) return;
    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES_ARCHIVO.includes(extension)) {
      this.errorChat.set(`"${archivo.name}" no tiene un formato permitido.`);
      return;
    }
    if (archivo.size > MAX_BYTES_ARCHIVO) {
      this.errorChat.set(`"${archivo.name}" supera el límite de 25 MB.`);
      return;
    }
    this.adjuntoChat.set(archivo);
    this.errorChat.set(null);
  }

  quitarAdjuntoChat(): void {
    this.adjuntoChat.set(null);
  }

  enviarRespuesta(): void {
    const solicitud = this.seleccionada();
    if (!solicitud || this.enviandoChat()) return;

    const mensaje = this.borradorChat().trim();
    const archivo = this.adjuntoChat();
    if (!mensaje && !archivo) {
      this.errorChat.set('Escribe una respuesta o adjunta un archivo.');
      return;
    }

    this.enviandoChat.set(true);
    this.errorChat.set(null);

    this.service
      .enviarMensajeInterno(solicitud.id, mensaje, archivo)
      .pipe(finalize(() => this.enviandoChat.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.mensajes.update((actuales) => [...actuales, respuesta.mensajeChat]);
          this.borradorChat.set('');
          this.adjuntoChat.set(null);
          this.desplazarHilo();
        },
        error: (respuesta: HttpErrorResponse) => {
          this.errorChat.set(
            respuesta.status === 403
              ? 'No tienes permisos para responder desde este buzón.'
              : respuesta.error?.error || 'No pudimos enviar la respuesta al cliente.',
          );
        },
      });
  }

  refrescarChat(): void {
    const solicitud = this.seleccionada();
    if (!solicitud) return;

    this.service.listarMensajesSolicitud(solicitud.id).subscribe({
      next: (respuesta) => {
        this.mensajes.set(respuesta.items);
        this.desplazarHilo();
      },
      error: () => this.errorChat.set('No pudimos actualizar la conversación.'),
    });
  }

  descargarAdjuntoChat(mensaje: MensajeChat): void {
    if (!mensaje.adjunto) return;

    this.descargandoAdjunto.set(mensaje.id);
    this.service
      .descargarAdjuntoMensaje(mensaje.id)
      .pipe(finalize(() => this.descargandoAdjunto.set(null)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = mensaje.adjunto?.nombre || 'adjunto';
          enlace.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.errorChat.set('No pudimos descargar el archivo adjunto.'),
      });
  }

  private desplazarHilo(): void {
    setTimeout(() => {
      const contenedor = this.hiloChat()?.nativeElement;
      if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
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
    return etiquetaDe(ESTADOS_SOLICITUD, estado);
  }

  claseEstado(estado: EstadoSolicitud): string {
    return badgeDe(ESTADOS_SOLICITUD, estado);
  }

  private recargarLista(): void {
    this.cargar(this.pagina());
    this.store.cargarResumen();
  }
}
