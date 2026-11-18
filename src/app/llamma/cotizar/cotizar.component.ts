import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { EXTENSIONES_ARCHIVO, MAX_BYTES_ARCHIVO } from '../estados';
import { LlammaService } from '../llamma.service';
import { CotizarComprobanteComponent } from './cotizar-comprobante/cotizar-comprobante.component';
import { CotizarPasosComponent } from './cotizar-pasos/cotizar-pasos.component';
import { CotizarResumenComponent } from './cotizar-resumen/cotizar-resumen.component';
import {
  ItemSolicitud,
  MetodoEntrega,
  ProductoPublico,
  SegmentoCliente,
  SolicitudCotizacion,
} from '../llamma.models';

const CLAVE_BORRADOR = 'llamma.cotizacion.borrador.v1';
const DIAS_BORRADOR = 30;

interface BorradorFormulario {
  nombreCliente: string;
  empresa: string;
  correo: string;
  telefono: string;
  segmento: SegmentoCliente;
  mensaje: string;
  fechaDeseada: string;
  metodoEntrega: MetodoEntrega;
}

interface ArchivoBorrador {
  nombre: string;
  tamano: number;
  tipo: string;
  modificado: number;
}

interface BorradorCotizacion {
  version: 1;
  guardadoEn: string;
  paso: number;
  form: BorradorFormulario;
  carrito: ItemSolicitud[];
  productoId: number | null;
  cantidad: number;
  especificaciones: string;
  archivos: ArchivoBorrador[];
}

@Component({
  selector: 'app-cotizar',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CotizarComprobanteComponent,
    CotizarPasosComponent,
    CotizarResumenComponent,
  ],
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

  readonly paso = signal(1);
  readonly borradorRecuperado = signal(false);
  readonly archivosPendientes = signal<string[]>([]);
  readonly pasos = [
    { numero: 1, titulo: 'Contacto', detalle: 'Quién solicita' },
    { numero: 2, titulo: 'Productos', detalle: 'Qué imprimimos' },
    { numero: 3, titulo: 'Proyecto', detalle: 'Mensaje y entrega' },
  ] as const;

  private persistenciaActiva = false;

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
    this.restaurarBorrador();
    this.form.valueChanges.subscribe(() => this.guardarBorrador());
    this.persistenciaActiva = true;

    this.service.listarProductosPublicos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.items);
        if (respuesta.items.length) {
          const solicitado = Number(this.route.snapshot.queryParamMap.get('producto'));
          const preseleccionado = respuesta.items.find((producto) => producto.id === solicitado);
          this.productoId.update(
            (actual) => actual ?? preseleccionado?.id ?? respuesta.items[0].id,
          );
        }
      },
      error: () =>
        this.error.set('No pudimos cargar el catálogo. Puedes describir tu proyecto abajo.'),
    });
  }

  irAPaso(destino: number): void {
    const objetivo = Math.min(Math.max(destino, 1), 3);
    if (objetivo > this.paso() && this.contactoInvalido()) {
      this.form.markAllAsTouched();
      this.paso.set(1);
      this.error.set('Completa tus datos de contacto para continuar.');
      setTimeout(() => this.enfocarPrimerError());
      return;
    }
    this.paso.set(objetivo);
    this.error.set(null);
    this.guardarBorrador();
    this.enfocarPaso(objetivo);
  }

  pasoSiguiente(): void {
    this.irAPaso(this.paso() + 1);
  }

  pasoAnterior(): void {
    this.irAPaso(this.paso() - 1);
  }

  ocultarAvisoBorrador(): void {
    this.borradorRecuperado.set(false);
  }

  descartarBorrador(): void {
    this.limpiarBorradorGuardado();
    this.borradorRecuperado.set(false);
    this.archivosPendientes.set([]);
    this.carrito.set([]);
    this.archivos.set([]);
    this.paso.set(1);
    this.reiniciarFormulario();
  }

  private contactoInvalido(): boolean {
    const { nombreCliente, correo, telefono } = this.form.controls;
    return nombreCliente.invalid || correo.invalid || telefono.invalid;
  }

  private guardarBorrador(): void {
    if (!this.persistenciaActiva || this.folio()) return;

    // Sin datos capturados no hay nada que recuperar (y evita reescribir un
    // borrador vacío justo después de descartarlo).
    if (!this.hayContenido()) {
      this.limpiarBorradorGuardado();
      return;
    }

    const borrador: BorradorCotizacion = {
      version: 1,
      guardadoEn: new Date().toISOString(),
      paso: this.paso(),
      form: this.form.getRawValue(),
      carrito: this.carrito(),
      productoId: this.productoId(),
      cantidad: this.cantidad(),
      especificaciones: this.especificaciones(),
      archivos: this.archivos().map((archivo) => ({
        nombre: archivo.name,
        tamano: archivo.size,
        tipo: archivo.type,
        modificado: archivo.lastModified,
      })),
    };

    try {
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
    } catch {
      // Sin espacio o almacenamiento bloqueado: seguimos sin borrador.
    }
  }

  private hayContenido(): boolean {
    const { nombreCliente, correo, telefono, mensaje } = this.form.getRawValue();
    return Boolean(
      this.carrito().length ||
      this.archivos().length ||
      nombreCliente.trim() ||
      correo.trim() ||
      telefono.trim() ||
      mensaje.trim(),
    );
  }

  private restaurarBorrador(): void {
    let crudo: string | null = null;
    try {
      crudo = localStorage.getItem(CLAVE_BORRADOR);
    } catch {
      return;
    }
    if (!crudo) return;

    try {
      const borrador = JSON.parse(crudo) as BorradorCotizacion;
      const guardado = new Date(borrador?.guardadoEn ?? 0).getTime();
      const vigente =
        borrador?.version === 1 && Number.isFinite(guardado)
          ? Date.now() - guardado <= DIAS_BORRADOR * 24 * 60 * 60 * 1000
          : false;
      if (!vigente) {
        this.limpiarBorradorGuardado();
        return;
      }

      const formulario = borrador.form ?? ({} as BorradorFormulario);
      const contenido =
        borrador.carrito?.length ||
        borrador.archivos?.length ||
        formulario.nombreCliente?.trim() ||
        formulario.correo?.trim() ||
        formulario.telefono?.trim() ||
        formulario.mensaje?.trim();
      if (!contenido) {
        this.limpiarBorradorGuardado();
        return;
      }

      this.form.patchValue(formulario);
      this.carrito.set(borrador.carrito ?? []);
      this.productoId.set(borrador.productoId ?? null);
      this.cantidad.set(borrador.cantidad ?? 1);
      this.especificaciones.set(borrador.especificaciones ?? '');
      this.archivosPendientes.set((borrador.archivos ?? []).map((archivo) => archivo.nombre));
      this.paso.set(Math.min(Math.max(borrador.paso ?? 1, 1), 3));
      this.borradorRecuperado.set(true);
    } catch {
      this.limpiarBorradorGuardado();
    }
  }

  private limpiarBorradorGuardado(): void {
    try {
      localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      // Almacenamiento no disponible: nada que limpiar.
    }
  }

  private reiniciarFormulario(): void {
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

  private enfocarPaso(paso: number): void {
    setTimeout(() => {
      const seccion = document.getElementById(`paso${paso}`);
      seccion?.focus();
      seccion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  private enfocarPrimerError(): void {
    const mapa: Array<[boolean, string]> = [
      [this.form.controls.nombreCliente.invalid, 'cotNombre'],
      [this.form.controls.correo.invalid, 'cotCorreo'],
      [this.form.controls.telefono.invalid, 'cotTelefono'],
      [this.form.controls.mensaje.invalid, 'cotMensaje'],
    ];
    const encontrado = mapa.find(([invalido]) => invalido);
    if (!encontrado) return;
    const campo = document.getElementById(encontrado[1]);
    campo?.focus();
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  cambiarProducto(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    this.productoId.set(Number.isNaN(valor) ? null : valor);
    this.guardarBorrador();
  }

  cambiarCantidad(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.cantidad.set(Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1);
    this.guardarBorrador();
  }

  cambiarEspecificaciones(evento: Event): void {
    this.especificaciones.set((evento.target as HTMLInputElement).value);
    this.guardarBorrador();
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
    this.guardarBorrador();
  }

  quitarProducto(indice: number): void {
    this.carrito.update((items) => items.filter((_, posicion) => posicion !== indice));
    this.guardarBorrador();
  }

  agregarArchivos(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const seleccionados = Array.from(input.files ?? []);
    input.value = '';

    const validos: File[] = [];
    for (const archivo of seleccionados) {
      const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSIONES_ARCHIVO.includes(extension)) {
        this.error.set(`"${archivo.name}" no tiene un formato permitido.`);
        continue;
      }
      if (archivo.size > MAX_BYTES_ARCHIVO) {
        this.error.set(`"${archivo.name}" supera el límite de 25 MB.`);
        continue;
      }
      validos.push(archivo);
    }

    if (validos.length) {
      this.archivos.update((actuales) => [...actuales, ...validos]);
      const nombres = new Set(validos.map((archivo) => archivo.name));
      this.archivosPendientes.update((pendientes) =>
        pendientes.filter((nombre) => !nombres.has(nombre)),
      );
      this.error.set(null);
      this.guardarBorrador();
    }
  }

  quitarArchivo(indice: number): void {
    this.archivos.update((archivos) => archivos.filter((_, posicion) => posicion !== indice));
    this.guardarBorrador();
  }

  enviar(): void {
    if (this.enviando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.paso.set(1);
      this.error.set('Revisa los datos de contacto: nos falta información para responderte.');
      setTimeout(() => this.enfocarPrimerError());
      return;
    }
    if (!this.carrito().length && this.form.controls.mensaje.value.trim().length < 20) {
      this.paso.set(3);
      this.error.set('Agrega al menos un producto o describe tu proyecto con más detalle.');
      setTimeout(() => this.enfocarPrimerError());
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
          this.limpiarBorradorGuardado();
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
    this.paso.set(1);
    this.borradorRecuperado.set(false);
    this.archivosPendientes.set([]);
    this.limpiarBorradorGuardado();
    this.reiniciarFormulario();
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
        lineas.push(
          `${indice + 1}. ${item.nombreProducto} — ${item.cantidad}${especificaciones}${precio}`,
        );
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
      'Consulta el estatus de tu solicitud en /seguimiento del portal',
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
}
