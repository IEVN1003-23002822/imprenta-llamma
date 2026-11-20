import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { LlammaService } from '../llamma.service';
import {
  EstadoSolicitud,
  ItemSolicitud,
  MensajeChat,
  MetodoEntrega,
  ProductoPublico,
  SeguimientoSolicitud,
  SegmentoCliente,
  SolicitudCotizacion,
} from '../llamma.models';

export interface MockupVista {
  id: string;
  nombre: string;
  imagenBase: string;
  top: string;
  left: string;
  width: string;
  height: string;
  transform?: string
}

const EXTENSIONES = ['pdf', 'ai', 'psd', 'png', 'jpg', 'jpeg', 'svg', 'zip'];
const MAX_BYTES = 25 * 1024 * 1024;

@Component({
  selector: 'app-cotizar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cotizar.component.html',
  styleUrl: './cotizar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LlammaService);
  private readonly route = inject(ActivatedRoute);

  readonly productos = signal<ProductoPublico[]>([]);
  readonly carrito = signal<ItemSolicitud[]>([]);
  readonly archivos = signal<File[]>([]);

  readonly productoId = signal<number | null>(null);
  readonly cantidad = signal(1);
  readonly especificaciones = signal('');

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly folio = signal<string | null>(null);
  readonly solicitudCreada = signal<SolicitudCotizacion | null>(null);
  readonly copiado = signal(false);

  readonly seguimiento = signal<SeguimientoSolicitud | null>(null);
  readonly buscando = signal(false);
  readonly errorSeguimiento = signal<string | null>(null);

  readonly mensajes = signal<MensajeChat[]>([]);
  readonly borrador = signal('');
  readonly adjuntoChat = signal<File | null>(null);
  readonly enviandoMensaje = signal(false);
  readonly errorChat = signal<string | null>(null);
  readonly descargandoAdjunto = signal<number | null>(null);
  private readonly hiloChat = viewChild<ElementRef<HTMLDivElement>>('hiloChat');

  readonly hoy = new Date().toISOString().slice(0, 10);

  readonly form = this.fb.nonNullable.group({
    nombreCliente: ['', [Validators.required, Validators.minLength(3)]],
    empresa: [''],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.minLength(8)]],
    segmento: ['pyme' as SegmentoCliente, [Validators.required]],
    mensaje: ['', [Validators.required, Validators.minLength(20)]],
    fechaDeseada: [''],
    metodoEntrega: ['taller' as MetodoEntrega, [Validators.required]],
  });

  readonly seguimientoForm = this.fb.nonNullable.group({
    folio: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email]],
  });

  readonly productoActual = computed(
    () => this.productos().find((producto) => producto.id === this.productoId()) ?? null,
  );

  readonly estimadoLinea = computed(
    () => (this.productoActual()?.precioBase ?? 0) * this.cantidad(),
  );

  readonly totalEstimado = computed(() =>
    this.carrito().reduce((total, item) => total + (item.precioEstimado ?? 0), 0),
  );

  readonly totalPiezas = computed(() =>
    this.carrito().reduce((total, item) => total + item.cantidad, 0),
  );

  readonly ivaEstimado = computed(() => Math.round(this.totalEstimado() * 0.16 * 100) / 100);

  readonly totalConIva = computed(
    () => Math.round((this.totalEstimado() + this.ivaEstimado()) * 100) / 100,
  );

  readonly partidasComprobante = computed<ItemSolicitud[]>(() => {
    const items = this.solicitudCreada()?.itemsSolicitados;
    return items && items.length ? items : this.carrito();
  });

  ngOnInit(): void {
    this.service.listarProductosPublicos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.items);
        if (respuesta.items.length) {
          const solicitado = Number(this.route.snapshot.queryParamMap.get('producto'));
          const preseleccionado = respuesta.items.find((producto) => producto.id === solicitado);
          this.productoId.set(preseleccionado?.id ?? respuesta.items[0].id);
        }
      },
      error: () =>
        this.error.set('No pudimos cargar el catálogo. Puedes describir tu proyecto abajo.'),
    });
  }

  cambiarProducto(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    this.productoId.set(Number.isNaN(valor) ? null : valor);
  }

  cambiarCantidad(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.cantidad.set(Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1);
  }

  cambiarEspecificaciones(evento: Event): void {
    this.especificaciones.set((evento.target as HTMLInputElement).value);
  }

  agregarProducto(): void {
    const producto = this.productoActual();
    if (!producto) {
      this.error.set('Selecciona un producto del catálogo para agregarlo.');
      return;
    }

    const cantidad = Math.max(this.cantidad(), 1);
    const item: ItemSolicitud = {
      productoId: producto.id,
      nombreProducto: producto.nombre,
      especificaciones:
        this.especificaciones().trim() ||
        (producto.unidadVenta === 'm2'
          ? 'Medida exacta por confirmar en diseño'
          : 'Especificaciones estándar'),
      cantidad,
      precioEstimado: Math.round(producto.precioBase * cantidad * 100) / 100,
    };

    this.carrito.update((items) => [...items, item]);
    this.cantidad.set(1);
    this.especificaciones.set('');
    this.error.set(null);
  }

  quitarProducto(indice: number): void {
    this.carrito.update((items) => items.filter((_, posicion) => posicion !== indice));
  }

  agregarArchivos(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const seleccionados = Array.from(input.files ?? []);
    input.value = '';

    const validos: File[] = [];
    for (const archivo of seleccionados) {
      const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSIONES.includes(extension)) {
        this.error.set(`"${archivo.name}" no tiene un formato permitido.`);
        continue;
      }
      if (archivo.size > MAX_BYTES) {
        this.error.set(`"${archivo.name}" supera el límite de 25 MB.`);
        continue;
      }
      validos.push(archivo);
    }

    if (validos.length) {
      this.archivos.update((actuales) => [...actuales, ...validos]);
      this.error.set(null);
    }
  }

  quitarArchivo(indice: number): void {
    this.archivos.update((archivos) => archivos.filter((_, posicion) => posicion !== indice));
  }

  enviar(): void {
    if (this.enviando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los datos de contacto: nos falta información para responderte.');
      return;
    }
    if (!this.carrito().length && this.form.controls.mensaje.value.trim().length < 20) {
      this.error.set('Agrega al menos un producto o describe tu proyecto con más detalle.');
      return;
    }

    const valores = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);

    this.service
      .crearSolicitud({
        nombreCliente: valores.nombreCliente.trim(),
        empresa: valores.empresa.trim() || undefined,
        correo: valores.correo.trim().toLowerCase(),
        telefono: valores.telefono.trim(),
        segmento: valores.segmento,
        mensaje: valores.mensaje.trim(),
        fechaDeseada: valores.fechaDeseada || null,
        metodoEntrega: valores.metodoEntrega,
        items: this.carrito(),
        archivos: this.archivos(),
      })
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.folio.set(respuesta.folio);
          this.solicitudCreada.set(respuesta.solicitud);
          window.scrollTo({ top: 0, behavior: 'auto' });
        },
        error: (respuesta: HttpErrorResponse) => {
          this.error.set(
            respuesta.status === 0
              ? 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.'
              : respuesta.error?.error || 'No pudimos enviar la solicitud. Revisa los datos.',
          );
        },
      });
  }

  nuevaSolicitud(): void {
    this.folio.set(null);
    this.solicitudCreada.set(null);
    this.carrito.set([]);
    this.archivos.set([]);
    this.copiado.set(false);
    this.form.reset({
      nombreCliente: '',
      empresa: '',
      correo: '',
      telefono: '',
      segmento: 'pyme',
      mensaje: '',
      fechaDeseada: '',
      metodoEntrega: 'taller',
    });
  }

  copiarFolio(): void {
    const folio = this.folio();
    if (!folio) return;
    navigator.clipboard?.writeText(folio).then(
      () => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 2200);
      },
      () => undefined,
    );
  }

  descargarComprobante(): void {
    const folio = this.folio();
    const solicitud = this.solicitudCreada();
    if (!folio) return;

    const lineas: string[] = [
      'LLAMMA · Imprenta y estudio de transformación',
      'Comprobante de solicitud de cotización',
      '==========================================',
      '',
      `Folio: ${folio}`,
      `Cliente: ${solicitud?.nombreCliente ?? ''}`,
    ];

    if (solicitud?.empresa) lineas.push(`Empresa o marca: ${solicitud.empresa}`);
    lineas.push(
      `Correo: ${solicitud?.correo ?? ''}`,
      `Teléfono / WhatsApp: ${solicitud?.telefono ?? ''}`,
      `Tipo de cliente: ${this.etiquetaSegmento(solicitud?.segmento)}`,
      `Fecha de solicitud: ${this.fecha(solicitud?.fechaCreacion ?? new Date().toISOString())}`,
      `Entrega preferida: ${this.etiquetaEntrega(solicitud?.metodoEntrega)}`,
      `Fecha deseada: ${this.fecha(solicitud?.fechaDeseada)}`,
      '',
      'Partidas solicitadas',
      '--------------------',
    );

    const partidas = this.partidasComprobante();
    if (partidas.length) {
      partidas.forEach((item, indice) => {
        const especificaciones = item.especificaciones ? ` · ${item.especificaciones}` : '';
        const precio = item.precioEstimado != null ? ` · ${this.moneda(item.precioEstimado)}` : '';
        lineas.push(`${indice + 1}. ${item.nombreProducto} — ${item.cantidad}${especificaciones}${precio}`);
      });
    } else {
      lineas.push('Sin partidas de catálogo: solicitud descrita en el mensaje.');
    }

    lineas.push(
      '',
      `Total de piezas / unidades: ${this.totalPiezas()}`,
      `Total estimado (IVA incluido): ${this.moneda(this.totalConIva())}`,
      '',
      'Mensaje del proyecto',
      '--------------------',
      solicitud?.mensaje?.trim() || 'Sin mensaje adicional.',
      '',
      '------------------------------------------',
      'Los precios son referenciales y están sujetos a revisión de diseño.',
      'Consulta el estatus de tu solicitud en /cotizar (sección Seguimiento)',
      `con el folio ${folio} y tu correo registrado.`,
    );

    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `LLAMMA-${folio}.txt`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  consultar(): void {
    if (this.seguimientoForm.invalid) {
      this.seguimientoForm.markAllAsTouched();
      return;
    }
    const { folio, correo } = this.seguimientoForm.getRawValue();
    this.buscando.set(true);
    this.errorSeguimiento.set(null);
    this.seguimiento.set(null);
    this.mensajes.set([]);
    this.borrador.set('');
    this.adjuntoChat.set(null);
    this.errorChat.set(null);

    this.service
      .consultarSolicitud(folio.trim(), correo.trim().toLowerCase())
      .pipe(finalize(() => this.buscando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.seguimiento.set(respuesta);
          this.mensajes.set(respuesta.mensajes ?? []);
          this.desplazarHilo();
        },
        error: (respuesta: HttpErrorResponse) => {
          this.errorSeguimiento.set(
            respuesta.status === 404
              ? 'No encontramos una solicitud con ese folio y correo.'
              : 'No pudimos consultar la solicitud. Intenta de nuevo.',
          );
        },
      });
  }

  actualizarBorrador(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
  }

  seleccionarAdjunto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';

    if (!archivo) return;
    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES.includes(extension)) {
      this.errorChat.set(`"${archivo.name}" no tiene un formato permitido.`);
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.errorChat.set(`"${archivo.name}" supera el límite de 25 MB.`);
      return;
    }
    this.adjuntoChat.set(archivo);
    this.errorChat.set(null);
  }

  quitarAdjuntoChat(): void {
    this.adjuntoChat.set(null);
  }

  enviarMensaje(): void {
    const solicitud = this.seguimiento();
    if (!solicitud || this.enviandoMensaje()) return;

    const mensaje = this.borrador().trim();
    const archivo = this.adjuntoChat();
    if (!mensaje && !archivo) {
      this.errorChat.set('Escribe un mensaje o adjunta un archivo de referencia.');
      return;
    }

    const { correo } = this.seguimientoForm.getRawValue();
    this.enviandoMensaje.set(true);
    this.errorChat.set(null);

    this.service
      .enviarMensajePublico(solicitud.folio, correo.trim().toLowerCase(), mensaje, archivo)
      .pipe(finalize(() => this.enviandoMensaje.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.mensajes.update((actuales) => [...actuales, respuesta.mensajeChat]);
          this.borrador.set('');
          this.adjuntoChat.set(null);
          this.desplazarHilo();
        },
        error: (respuesta: HttpErrorResponse) => {
          this.errorChat.set(
            respuesta.status === 404
              ? 'Tu folio y correo ya no coinciden. Vuelve a consultar la solicitud.'
              : respuesta.error?.error || 'No pudimos enviar tu mensaje. Intenta de nuevo.',
          );
        },
      });
  }

  refrescarChat(): void {
    const solicitud = this.seguimiento();
    if (!solicitud) return;
    const { correo } = this.seguimientoForm.getRawValue();

    this.service.listarMensajesPublicos(solicitud.folio, correo.trim().toLowerCase()).subscribe({
      next: (respuesta) => {
        this.mensajes.set(respuesta.items);
        this.desplazarHilo();
      },
      error: () => this.errorChat.set('No pudimos actualizar la conversación.'),
    });
  }

  descargarAdjuntoChat(mensaje: MensajeChat): void {
    const solicitud = this.seguimiento();
    if (!solicitud || !mensaje.adjunto) return;

    const { correo } = this.seguimientoForm.getRawValue();
    this.descargandoAdjunto.set(mensaje.id);
    this.service
      .descargarAdjuntoPublico(solicitud.folio, correo.trim().toLowerCase(), mensaje.id)
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

  fechaHoraChat(valor: string | null | undefined): string {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  tamanoChat(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private desplazarHilo(): void {
    setTimeout(() => {
      const contenedor = this.hiloChat()?.nativeElement;
      if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
    });
  }

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

  tamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  etiquetaEstado(estado: EstadoSolicitud): string {
    const etiquetas: Record<EstadoSolicitud, string> = {
      nueva: 'Recibida',
      'en-revision': 'En revisión',
      cotizada: 'Cotizada',
      convertida: 'Convertida a pedido',
      descartada: 'Descartada',
    };
    return etiquetas[estado];
  }

  etiquetaSegmento(segmento: SegmentoCliente | null | undefined): string {
    const etiquetas: Record<SegmentoCliente, string> = {
      particular: 'Particular',
      pyme: 'Pyme',
      corporativo: 'Corporativo',
      eventos: 'Eventos',
      escolar: 'Escolar',
      gobierno: 'Gobierno',
      otro: 'Otro',
    };
    return segmento ? etiquetas[segmento] : 'Por confirmar';
  }

  etiquetaEntrega(metodo: MetodoEntrega | null | undefined): string {
    const etiquetas: Record<MetodoEntrega, string> = {
      taller: 'Recoger en taller',
      domicilio: 'Envío a domicilio',
      paqueteria: 'Paquetería nacional',
      instalacion: 'Instalación en sitio',
    };
    return metodo ? etiquetas[metodo] : 'Por confirmar';
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

MOCKUPS_CATALOGO: Record<string, MockupVista[]> = {
    'Lona Frontlit impresa': [
      {
        id: 'lona-1',
        nombre: 'Estructura',
        imagenBase: 'assets/images/mockups/lona-1.png',
        top: '15.2%', left: '31.2%', width: '38.6%', height: '27.6%'
      },
      {
        id: 'lona-2',
        nombre: 'En calle',
        imagenBase: 'assets/images/mockups/lona-2.png',
        top: '27.5%', left: '34.5%', width: '42%', height: '25.5%',
transform: 'perspective(700px) rotateX(5deg) rotateY(3deg) rotateZ(4.5deg) skewY(2deg)'
      }
    ],
    'Roll-up premium 85 × 200 cm': [
      {
        id: 'rollup-1',
        nombre: 'Estudio',
        imagenBase: 'assets/images/mockups/rollup-1.png',
        top: '10.8%', left: '38.6%', width: '22.4%', height: '77.2%'
      },
      {
        id: 'rollup-2',
        nombre: 'En ambiente',
        imagenBase: 'assets/images/mockups/rollup-2.png',
        top: '16.5%', left: '33%', width: '14.5%', height: '69%',
transform: 'perspective(700px) rotateY(-21.5deg) skewY(4.5deg)'
      }
    ],
    'Playera DTF unisex': [
      {
        id: 'playera-1',
        nombre: 'Espalda / Plana',
        imagenBase: 'assets/images/mockups/playera-1.png',
        top: '20%', left: '35%', width: '30%', height: '62%'
      },
      {
        id: 'playera-2',
        nombre: 'Modelo',
        imagenBase: 'assets/images/mockups/playera-2.png',
        top: '50%', left: '42%', width: '12.5%', height: '38%',
transform: 'perspective(700px) rotateY(-15deg)'
      }
    ],
    'Sticker troquelado': [
      {
        id: 'sticker-1',
        nombre: 'Sticker completo',
        imagenBase: 'assets/images/mockups/sticker-1.png',
        top: '1%', left: '0.5%', width: '91%', height: '88%'
      },
      {
        id: 'sticker-2',
        nombre: 'En carpeta',
        imagenBase: 'assets/images/mockups/sticker-2.png',
        top: '26%', left: '39.5%', width: '14.8%', height: '20.5%',
transform: 'rotateZ(-4deg)'
      }
    ],
    'Tarjetas Couché 300g': [
      {
        id: 'tarjetas-1',
        nombre: 'Vista 1',
        imagenBase: 'assets/images/mockups/tarjetas-1.png',
        top: '29.8%', left: '32.6%', width: '34.4%', height: '33.2%'
      },
      {
        id: 'tarjetas-2',
        nombre: 'Vista 2',
        imagenBase: 'assets/images/mockups/tarjetas-2.png',
        top: '44.5%', left: '42%', width: '38.5%', height: '36.5%',
transform: 'rotateZ(-24.5deg)'
      }
    ],
    'Taza cerámica sublimada': [
      {
        id: 'taza-1',
        nombre: 'Vista 1',
        imagenBase: 'assets/images/mockups/taza-1.png',
        top: '5.5%', left: '34.5%', width: '64.5%', height: '88.5%'
      },
      {
        id: 'taza-2',
        nombre: 'Vista 2',
        imagenBase: 'assets/images/mockups/taza-2.png',
        top: '57.5%', left: '42%', width: '19%', height: '15.5%',
transform: 'perspective(700px) rotateX(-20.5deg) skewY(1deg)'
      }
    ],
    'Tote bag de manta': [
      {
        id: 'totebag-1',
        nombre: 'Vista 1',
        imagenBase: 'assets/images/mockups/totebag-1.png',
        top: '44.5%', left: '25%', width: '18%', height: '35%'
      },
      {
        id: 'totebag-2',
        nombre: 'Vista 2',
        imagenBase: 'assets/images/mockups/totebag-2.png',
        top: '61.5%', left: '40.5%', width: '15.5%', height: '25.5%'
      }
    ]
  };

  // Cambia esto a false cuando termines de calibrar tus 14 mockups
  readonly mostrarCalibrador = false;

  readonly showPreviewModal = signal(false);
  readonly previewImage = signal<string | null>(null);
  readonly selectedMockupIndex = signal(0);

  // Controles del cliente (dentro del área de impresión)
  readonly designFit = signal<'contain' | 'cover'>('contain');
  readonly designScale = signal(100);
  readonly designOffsetX = signal(0);
  readonly designOffsetY = signal(0);

  // Controles del calibrador (solo para ti al ajustar coordenadas)
  readonly modoCalibracion = signal(false);
  readonly calTop = signal(20);
  readonly calLeft = signal(20);
  readonly calWidth = signal(40);
  readonly calHeight = signal(30);
  readonly calRotateY = signal(0);
  readonly calRotateX = signal(0);
  readonly calRotateZ = signal(0);
  readonly calSkewY = signal(0);
  readonly calCopiado = signal(false);

  readonly currentMockups = computed<MockupVista[]>(() => {
    const nombreProd = this.productoActual()?.nombre ?? 'Lona Frontlit impresa';
    return this.MOCKUPS_CATALOGO[nombreProd] || this.MOCKUPS_CATALOGO['Lona Frontlit impresa'];
  });

  readonly activeMockup = computed<MockupVista>(() => {
    const vistas = this.currentMockups();
    return vistas[this.selectedMockupIndex()] || vistas[0];
  });

  readonly designTransform = computed(
    () => `translate(${this.designOffsetX()}%, ${this.designOffsetY()}%) scale(${this.designScale() / 100})`,
  );

  readonly calTransform = computed(() => {
    const partes: string[] = [];
    if (this.calRotateX() !== 0 || this.calRotateY() !== 0) {
      partes.push('perspective(700px)');
    }
    if (this.calRotateX() !== 0) partes.push(`rotateX(${this.calRotateX()}deg)`);
    if (this.calRotateY() !== 0) partes.push(`rotateY(${this.calRotateY()}deg)`);
    if (this.calRotateZ() !== 0) partes.push(`rotateZ(${this.calRotateZ()}deg)`);
    if (this.calSkewY() !== 0) partes.push(`skewY(${this.calSkewY()}deg)`);
    return partes.length ? partes.join(' ') : 'none';
  });

  readonly areaStyle = computed(() => {
    if (this.modoCalibracion()) {
      return {
        top: `${this.calTop()}%`,
        left: `${this.calLeft()}%`,
        width: `${this.calWidth()}%`,
        height: `${this.calHeight()}%`,
        transform: this.calTransform(),
      };
    }
    const vista = this.activeMockup();
    return {
      top: vista.top,
      left: vista.left,
      width: vista.width,
      height: vista.height,
      transform: vista.transform || 'none',
    };
  });

  readonly snippetCalibrador = computed(() => {
    const base = `top: '${this.calTop()}%', left: '${this.calLeft()}%', width: '${this.calWidth()}%', height: '${this.calHeight()}%'`;
    const tr = this.calTransform();
    return tr !== 'none' ? `${base},\ntransform: '${tr}'` : base;
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage.set(typeof reader.result === 'string' ? reader.result : null);
      this.resetDesignControls();
    };
    reader.readAsDataURL(file);
  }

  selectMockup(index: number): void {
    this.selectedMockupIndex.set(index);
    if (this.modoCalibracion()) {
      this.cargarCalibradorDesdeMockup();
    }
  }

  openPreview(): void {
    this.selectedMockupIndex.set(0);
    this.showPreviewModal.set(true);
    if (this.modoCalibracion()) {
      this.cargarCalibradorDesdeMockup();
    }
  }

  closePreview(): void {
    this.showPreviewModal.set(false);
  }

  setDesignFit(fit: 'contain' | 'cover'): void {
    this.designFit.set(fit);
  }

  actualizarNumero(destino: 'scale' | 'x' | 'y' | 'top' | 'left' | 'width' | 'height' | 'rx' | 'ry' | 'rz' | 'sy', event: Event): void {
    const valor = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(valor)) return;
    switch (destino) {
      case 'scale': this.designScale.set(valor); break;
      case 'x': this.designOffsetX.set(valor); break;
      case 'y': this.designOffsetY.set(valor); break;
      case 'top': this.calTop.set(valor); break;
      case 'left': this.calLeft.set(valor); break;
      case 'width': this.calWidth.set(valor); break;
      case 'height': this.calHeight.set(valor); break;
      case 'rx': this.calRotateX.set(valor); break;
      case 'ry': this.calRotateY.set(valor); break;
      case 'rz': this.calRotateZ.set(valor); break;
      case 'sy': this.calSkewY.set(valor); break;
    }
  }

  resetDesignControls(): void {
    this.designFit.set('contain');
    this.designScale.set(100);
    this.designOffsetX.set(0);
    this.designOffsetY.set(0);
  }

  toggleCalibracion(): void {
    const activo = !this.modoCalibracion();
    this.modoCalibracion.set(activo);
    if (activo) {
      this.cargarCalibradorDesdeMockup();
    }
  }

  private cargarCalibradorDesdeMockup(): void {
    const vista = this.activeMockup();
    this.calTop.set(Number.parseFloat(vista.top) || 0);
    this.calLeft.set(Number.parseFloat(vista.left) || 0);
    this.calWidth.set(Number.parseFloat(vista.width) || 30);
    this.calHeight.set(Number.parseFloat(vista.height) || 30);

    const tr = vista.transform ?? '';
    const leer = (fn: string) => {
      const m = new RegExp(`${fn}\\((-?\\d+(?:\\.\\d+)?)deg\\)`).exec(tr);
      return m ? Number(m[1]) : 0;
    };
    this.calRotateX.set(leer('rotateX'));
    this.calRotateY.set(leer('rotateY'));
    this.calRotateZ.set(leer('rotateZ'));
    this.calSkewY.set(leer('skewY'));
  }

  copiarCalibracion(): void {
    navigator.clipboard?.writeText(this.snippetCalibrador()).then(
      () => {
        this.calCopiado.set(true);
        setTimeout(() => this.calCopiado.set(false), 2000);
      },
      () => undefined,
    );
  }
  
}

