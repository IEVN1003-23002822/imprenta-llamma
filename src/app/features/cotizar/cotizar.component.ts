import { HttpErrorResponse } from '@angular/common/http';
import { CotizarMockup3dComponent } from './cotizar-mockup-3d/cotizar-mockup-3d.component';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  MENSAJE_FECHA_MINIMA,
  calcularFechaMinimaEntrega,
  esFechaEntregaValida,
} from '../../core/utils/fechas';
import { precioLineaMayoreo, redondearMoneda } from '../../core/utils/precios';
import { EXTENSIONES_ARCHIVO, MAX_BYTES_ARCHIVO } from '../../core/models/estados';
import { LlammaService } from '../../core/services/llamma.service';
import { ModalAccesibleDirective } from '../../shared/modal-accesible.directive';
import { CotizarComprobanteComponent } from './cotizar-comprobante/cotizar-comprobante.component';
import type { CapturaDiseno } from './cotizar-comprobante/cotizar-comprobante.component';
import { CotizarPasosComponent } from './cotizar-pasos/cotizar-pasos.component';
import { CotizarResumenComponent } from './cotizar-resumen/cotizar-resumen.component';
import {
  ItemSolicitud,
  MetodoEntrega,
  MockupDisenoData,
  ProductoPublico,
  SegmentoCliente,
  SolicitudCotizacion,
} from '../../core/models/llamma.models';

const CLAVE_BORRADOR = 'llamma.cotizacion.borrador.v1';
const LONA_BASE = 220;
const LONA_ADICIONAL = 120;
const VINIL_BASE = 180;
const VINIL_ADICIONAL = 90;
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

/** Área de impresión de una foto de producto, en porcentajes del lienzo. */
export interface MockupVista {
  id: string;
  nombre: string;
  imagenBase: string;
  top: string;
  left: string;
  width: string;
  height: string;
  transform?: string;
}

/**
 * Vistas de mockup por nombre de producto. Las imágenes son copias WebP
 * optimizadas y viven en `src/assets/images/mockups/`.
 * Las coordenadas son porcentajes, así que no dependen de la resolución.
 */
const MOCKUPS_CATALOGO: Record<string, MockupVista[]> = {
  'Lona/Vinil': [
    {
      id: 'lona-1',
      nombre: 'Estructura',
      imagenBase: 'assets/images/mockups/lona-1.webp',
      top: '15.2%',
      left: '31.2%',
      width: '38.6%',
      height: '27.6%',
    },
    {
      id: 'lona-2',
      nombre: 'En calle',
      imagenBase: 'assets/images/mockups/lona-2.webp',
      top: '27.5%',
      left: '34.5%',
      width: '42%',
      height: '25.5%',
      transform: 'perspective(700px) rotateX(5deg) rotateY(3deg) rotateZ(4.5deg) skewY(2deg)',
    },
  ],
  'Roll-up premium 85 × 200 cm': [
    {
      id: 'rollup-1',
      nombre: 'Estudio',
      imagenBase: 'assets/images/mockups/rollup-1.webp',
      top: '10.8%',
      left: '38.6%',
      width: '22.4%',
      height: '77.2%',
    },
    {
      id: 'rollup-2',
      nombre: 'En ambiente',
      imagenBase: 'assets/images/mockups/rollup-2.webp',
      top: '16.5%',
      left: '33%',
      width: '14.5%',
      height: '69%',
      transform: 'perspective(700px) rotateY(-21.5deg) skewY(4.5deg)',
    },
  ],
  'Playera DTF 29 × 29 cm': [
    {
      id: 'playera-1',
      nombre: 'Espalda / Plana',
      imagenBase: 'assets/images/mockups/playera-1.webp',
      top: '20%',
      left: '35%',
      width: '30%',
      height: '62%',
    },
    {
      id: 'playera-2',
      nombre: 'Modelo',
      imagenBase: 'assets/images/mockups/playera-2.webp',
      top: '50%',
      left: '42%',
      width: '12.5%',
      height: '38%',
      transform: 'perspective(700px) rotateY(-15deg)',
    },
  ],
  'Sticker troquelado': [
    {
      id: 'sticker-1',
      nombre: 'Sticker completo',
      imagenBase: 'assets/images/mockups/sticker-1.webp',
      top: '1%',
      left: '0.5%',
      width: '91%',
      height: '88%',
    },
    {
      id: 'sticker-2',
      nombre: 'En carpeta',
      imagenBase: 'assets/images/mockups/sticker-2.webp',
      top: '26%',
      left: '39.5%',
      width: '14.8%',
      height: '20.5%',
      transform: 'rotateZ(-4deg)',
    },
  ],
  'Tarjetas Couché 300g': [
    {
      id: 'tarjetas-1',
      nombre: 'Vista 1',
      imagenBase: 'assets/images/mockups/tarjetas-1.webp',
      top: '29.8%',
      left: '32.6%',
      width: '34.4%',
      height: '33.2%',
    },
    {
      id: 'tarjetas-2',
      nombre: 'Vista 2',
      imagenBase: 'assets/images/mockups/tarjetas-2.webp',
      top: '44.5%',
      left: '42%',
      width: '38.5%',
      height: '36.5%',
      transform: 'rotateZ(-24.5deg)',
    },
  ],
  'Taza cerámica sublimada': [
    {
      id: 'taza-1',
      nombre: 'Vista 1',
      imagenBase: 'assets/images/mockups/taza-1.webp',
      top: '5.5%',
      left: '34.5%',
      width: '64.5%',
      height: '88.5%',
    },
    {
      id: 'taza-2',
      nombre: 'Vista 2',
      imagenBase: 'assets/images/mockups/taza-2.webp',
      top: '57.5%',
      left: '42%',
      width: '19%',
      height: '15.5%',
      transform: 'perspective(700px) rotateX(-20.5deg) skewY(1deg)',
    },
  ],
  'Tote bag de manta': [
    {
      id: 'totebag-1',
      nombre: 'Vista 1',
      imagenBase: 'assets/images/mockups/totebag-1.webp',
      top: '44.5%',
      left: '25%',
      width: '18%',
      height: '35%',
    },
    {
      id: 'totebag-2',
      nombre: 'Vista 2',
      imagenBase: 'assets/images/mockups/totebag-2.webp',
      top: '61.5%',
      left: '40.5%',
      width: '15.5%',
      height: '25.5%',
    },
  ],
};

MOCKUPS_CATALOGO['Playera DTF menor a 29 × 29 cm'] = MOCKUPS_CATALOGO['Playera DTF 29 × 29 cm'];
// Compatibilidad con solicitudes creadas antes del renombre del producto.
MOCKUPS_CATALOGO['Lona Frontlit impresa'] = MOCKUPS_CATALOGO['Lona/Vinil'];

@Component({
  selector: 'app-cotizar',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalAccesibleDirective,
    CotizarComprobanteComponent,
    CotizarPasosComponent,
    CotizarResumenComponent,
    CotizarMockup3dComponent,
  ],
  templateUrl: './cotizar.component.html',
  styleUrl: './cotizar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LlammaService);
  private readonly route = inject(ActivatedRoute);
  private miniaturas = new WeakMap<File, string>();
  private readonly urlsMiniaturas = new Set<string>();

  readonly productos = signal<ProductoPublico[]>([]);
  readonly carrito = signal<ItemSolicitud[]>([]);
  readonly archivos = signal<File[]>([]);
  /** Metadatos de las capturas de mockup, emparejados por nombre de archivo. */
  readonly mockups = signal<Array<{ nombre: string; datos: MockupDisenoData }>>([]);
  readonly capturando2d = signal(false);
  readonly diseno2dAdjuntado = signal(false);

  readonly productoId = signal<number | null>(null);
  readonly cantidad = signal(1);
  readonly anchoMetros = signal(2);
  readonly altoMetros = signal(1);
  readonly material = signal<'lona' | 'vinil'>('lona');

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

  readonly fechaMinima = calcularFechaMinimaEntrega();

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

  readonly esPorM2 = computed(() => this.productoActual()?.unidadVenta === 'm2');
  readonly esLonaFrontlit = computed(() => {
    const nombre = (this.productoActual()?.nombre ?? '').toLowerCase();
    return nombre.includes('lona/vinil') || nombre.includes('lona frontlit');
  });

  readonly areaTotalM2 = computed(() => {
    const area = this.anchoMetros() * this.altoMetros() * this.cantidad();
    return Math.round(area * 100) / 100;
  });

  /** Unidades de la línea: m² para área, cantidad para piezas. */
  readonly lineaCantidad = computed(() => {
    const producto = this.productoActual();
    if (!producto) return 0;
    if (this.esLonaFrontlit()) {
      return Math.round(this.anchoMetros() * this.altoMetros() * 100) / 100;
    }
    return producto.unidadVenta === 'm2' ? this.areaTotalM2() : this.cantidad();
  });

  /** Importe antes de mayoreo para la línea que se está configurando. */
  readonly lineaBase = computed(() => {
    const producto = this.productoActual();
    if (!producto) return 0;
    if (this.esLonaFrontlit()) {
      return this.precioMaterial(this.anchoMetros() * this.altoMetros());
    }
    const factor = producto.unidadVenta === 'm2' ? this.areaTotalM2() : this.cantidad();
    return Math.round(producto.precioBase * factor * 100) / 100;
  });

  readonly lineaMayoreo = computed(() =>
    precioLineaMayoreo(this.lineaCantidad(), this.lineaBase()),
  );

  readonly descuentoLinea = computed(() => this.lineaMayoreo().descuento);

  readonly estimadoLinea = computed(() => this.lineaMayoreo().total);

  readonly precioUnitarioLinea = computed(() => {
    const unidades = this.lineaCantidad();
    return unidades > 0 ? redondearMoneda(this.estimadoLinea() / unidades) : 0;
  });

  readonly totalEstimado = computed(() =>
    this.carrito().reduce((total, item) => total + (item.precioEstimado ?? 0), 0),
  );

  readonly totalDescuentoMayoreo = computed(() =>
    redondearMoneda(
      this.carrito().reduce((total, item) => total + Number(item.descuentoMayoreo ?? 0), 0),
    ),
  );

  readonly subtotalSinMayoreo = computed(() =>
    redondearMoneda(this.totalEstimado() + this.totalDescuentoMayoreo()),
  );

  readonly totalPiezas = computed(
    () => Math.round(this.carrito().reduce((total, item) => total + item.cantidad, 0) * 100) / 100,
  );

  readonly ivaEstimado = computed(() => Math.round(this.totalEstimado() * 0.16 * 100) / 100);

  readonly totalConIva = computed(
    () => Math.round((this.totalEstimado() + this.ivaEstimado()) * 100) / 100,
  );

  readonly partidasComprobante = computed<ItemSolicitud[]>(() => {
    const items = this.solicitudCreada()?.itemsSolicitados;
    return items && items.length ? items : this.carrito();
  });

  /**
   * Capturas 2D/3D del previsualizador que siguen en memoria al mostrar el
   * comprobante. Se emparejan por nombre con `mockups` para excluir otros adjuntos.
   */
  readonly capturasDiseno = computed<CapturaDiseno[]>(() =>
    this.mockups()
      .map((mockup) => ({
        datos: mockup.datos,
        archivo: this.archivos().find((archivo) => archivo.name === mockup.nombre),
      }))
      .filter((captura): captura is CapturaDiseno => Boolean(captura.archivo)),
  );

  /* ------------------------------- Mockups -------------------------------- */

  /**
   * El calibrador es una herramienta interna: solo aparece con
   * `/cotizar?calibrar=1`. El cliente ve la previsualización sin controles
   * técnicos, y las coordenadas siguen editables desde ese modo.
   */
  readonly mostrarCalibrador = this.route.snapshot.queryParamMap.get('calibrar') === '1';

  readonly showPreviewModal = signal(false);

  readonly showPreview3dModal = signal(false);

  openPreview3d(): void {
    this.showPreview3dModal.set(true);
  }

  closePreview3d(): void {
    this.showPreview3dModal.set(false);
  }

  adjuntarCaptura3d(evento: { archivo: File; datos: MockupDisenoData }): void {
    const anterior = this.archivos().find((archivo) => archivo.name === evento.archivo.name);
    if (anterior) this.revocarMiniatura(anterior);
    this.archivos.update((actuales) => [
      ...actuales.filter((archivo) => archivo.name !== evento.archivo.name),
      evento.archivo,
    ]);
    this.mockups.update((actuales) => [
      ...actuales.filter((mockup) => mockup.nombre !== evento.archivo.name),
      { nombre: evento.archivo.name, datos: evento.datos },
    ]);
    this.error.set(null);
  }

  /**
   * Compone la foto del producto con el diseño del cliente en un canvas y la
   * adjunta a la solicitud. Así producción recibe la misma vista del modal 2D.
   */
  async adjuntarDiseno2d(): Promise<void> {
    const vista = this.activeMockup();
    const diseno = this.previewImage();
    if (!vista) {
      this.error.set('Este producto no tiene previsualización disponible.');
      return;
    }
    if (!diseno) {
      this.error.set('Sube una imagen y colócala en el producto antes de adjuntar el diseño.');
      return;
    }
    if (this.capturando2d()) return;

    this.capturando2d.set(true);
    this.error.set(null);
    try {
      const [base, capa] = await Promise.all([
        this.cargarImagen(vista.imagenBase),
        this.cargarImagen(diseno),
      ]);
      const canvas = document.createElement('canvas');
      const anchoBase = base.naturalWidth || 1200;
      const altoBase = base.naturalHeight || 900;
      const escalaSalida = Math.min(1600 / anchoBase, 1.6);
      canvas.width = Math.round(anchoBase * escalaSalida);
      canvas.height = Math.round(altoBase * escalaSalida);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_no_disponible');
      ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

      const area = this.areaStyle();
      const proporcion = (valor: string) => (Number.parseFloat(valor) || 0) / 100;
      const x = proporcion(area.left) * canvas.width;
      const y = proporcion(area.top) * canvas.height;
      const w = proporcion(area.width) * canvas.width;
      const h = proporcion(area.height) * canvas.height;

      const ratio = (capa.naturalWidth || 1) / (capa.naturalHeight || 1);
      let dibujoW = w;
      let dibujoH = w / ratio;
      if (this.designFit() === 'cover' || dibujoH > h) {
        dibujoH = h;
        dibujoW = h * ratio;
      }
      if (dibujoW > w) {
        dibujoW = w;
        dibujoH = w / ratio;
      }
      const factor = this.designScale() / 100;
      dibujoW *= factor;
      dibujoH *= factor;
      const desplazamientoX = (this.designOffsetX() / 100) * w;
      const desplazamientoY = (this.designOffsetY() / 100) * h;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(
        capa,
        x + (w - dibujoW) / 2 + desplazamientoX,
        y + (h - dibujoH) / 2 + desplazamientoY,
        dibujoW,
        dibujoH,
      );
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('sin_blob');

      const archivo = new File([blob], `diseno-${this.slugProducto()}-2d.jpg`, {
        type: 'image/jpeg',
      });
      this.adjuntarCaptura3d({ archivo, datos: this.datosMockup2d() });
      this.diseno2dAdjuntado.set(true);
      setTimeout(() => this.diseno2dAdjuntado.set(false), 2500);
    } catch {
      this.error.set('No pudimos generar la captura del diseño. Intenta de nuevo.');
    } finally {
      this.capturando2d.set(false);
    }
  }

  private datosMockup2d(): MockupDisenoData {
    const producto = this.productoActual();
    return {
      productoId: producto?.id ?? null,
      productoNombre: producto?.nombre ?? '',
      vista: '2d',
      color: '',
      material: this.esLonaFrontlit() ? this.material() : null,
      medidas: this.esPorM2() ? { ancho: this.anchoMetros(), alto: this.altoMetros() } : null,
      capas: this.previewImage()
        ? [
            {
              nombre: this.nombreDiseno(),
              x: this.designOffsetX(),
              y: this.designOffsetY(),
              escala: this.designScale() / 100,
              rotacion: 0,
            },
          ]
        : [],
      capturadoEn: new Date().toISOString(),
    };
  }

  private nombreDiseno(): string {
    return this.disenoNombre();
  }

  private cargarImagen(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const imagen = new Image();
      imagen.decoding = 'async';
      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error(`No pudimos cargar ${src}`));
      imagen.src = src;
    });
  }

  private slugProducto(): string {
    return (
      (this.productoActual()?.nombre ?? 'producto')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'producto'
    );
  }

  readonly previewImage = signal<string | null>(null);
  readonly disenoNombre = signal('diseno');
  readonly selectedMockupIndex = signal(0);

  readonly designFit = signal<'contain' | 'cover'>('contain');
  readonly designScale = signal(100);
  readonly designOffsetX = signal(0);
  readonly designOffsetY = signal(0);

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
    const nombre = this.productoActual()?.nombre;
    if (!nombre) return MOCKUPS_CATALOGO['Lona/Vinil'];
    return MOCKUPS_CATALOGO[nombre] ?? [];
  });

  readonly activeMockup = computed<MockupVista | null>(() => {
    const vistas = this.currentMockups();
    return vistas[this.selectedMockupIndex()] ?? vistas[0] ?? null;
  });

  readonly designTransform = computed(
    () =>
      `translate(${this.designOffsetX()}%, ${this.designOffsetY()}%) scale(${this.designScale() / 100})`,
  );

  readonly calTransform = computed(() => {
    const partes: string[] = [];
    if (this.calRotateX() !== 0 || this.calRotateY() !== 0) partes.push('perspective(700px)');
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
    if (!vista) {
      return { top: '20%', left: '20%', width: '40%', height: '30%', transform: 'none' };
    }
    return {
      top: vista.top,
      left: vista.left,
      width: vista.width,
      height: vista.height,
      transform: vista.transform ?? 'none',
    };
  });

  readonly snippetCalibrador = computed(() => {
    const base = `top: '${this.calTop()}%', left: '${this.calLeft()}%', width: '${this.calWidth()}%', height: '${this.calHeight()}%'`;
    const transform = this.calTransform();
    return transform === 'none' ? base : `${base},\ntransform: '${transform}'`;
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

  ngOnDestroy(): void {
    this.revocarMiniaturas();
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
    this.revocarMiniaturas();
    this.mockups.set([]);
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
    this.material.set('lona');
    this.cantidad.set(1);
    this.guardarBorrador();
  }

  cambiarMaterial(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.material.set(valor === 'vinil' ? 'vinil' : 'lona');
  }

  cambiarAncho(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.anchoMetros.set(Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0);
  }

  cambiarAlto(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.altoMetros.set(Number.isFinite(valor) ? Math.round(valor * 100) / 100 : 0);
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

  private precioMaterial(area: number): number {
    const esVinil = this.material() === 'vinil';
    const base = esVinil ? VINIL_BASE : LONA_BASE;
    const adicional = esVinil ? VINIL_ADICIONAL : LONA_ADICIONAL;
    return Math.round((base + Math.max(0, area - 1) * adicional) * 100) / 100;
  }

  agregarProducto(): void {
    const producto = this.productoActual();
    if (!producto) {
      this.error.set('Selecciona un producto del catálogo para agregarlo.');
      return;
    }
    if (producto.unidadVenta === 'm2' && (this.anchoMetros() <= 0 || this.altoMetros() <= 0)) {
      this.error.set('Captura un ancho y un largo mayores a cero.');
      return;
    }

    const esLona = this.esLonaFrontlit();
    const piezas = esLona ? 1 : Math.max(this.cantidad(), 1);
    const notas = this.especificaciones().trim();

    let cantidadFinal = piezas;
    let especificacionesFinal = notas || 'Especificaciones estándar';

    if (producto.unidadVenta === 'm2') {
      const ancho = this.anchoMetros();
      const alto = this.altoMetros();
      const totalM2 = esLona ? ancho * alto : this.areaTotalM2();
      const redondeado = Math.round(totalM2 * 100) / 100;
      cantidadFinal = redondeado;
      const textoMedida =
        piezas > 1
          ? `${piezas} lonas de ${ancho} × ${alto} m (${redondeado} m²)`
          : `Medida ${ancho} × ${alto} m (${redondeado} m²)`;
      const materialTexto = esLona
        ? `Material: ${this.material() === 'vinil' ? 'Vinil' : 'Lona'} · `
        : '';
      especificacionesFinal = `${materialTexto}${textoMedida}${notas ? ` · ${notas}` : ''}`;
    }

    const nombreProducto =
      esLona && this.material() === 'vinil' ? `${producto.nombre} (Vinil)` : producto.nombre;
    const precioEstimado = this.estimadoLinea();
    const descuentoMayoreo = this.descuentoLinea();

    const item: ItemSolicitud = {
      productoId: producto.id,
      nombreProducto,
      especificaciones: especificacionesFinal,
      cantidad: cantidadFinal,
      precioEstimado: redondearMoneda(precioEstimado),
      descuentoMayoreo: redondearMoneda(descuentoMayoreo),
    };

    this.carrito.update((items) => [...items, item]);
    this.cantidad.set(1);
    this.anchoMetros.set(2);
    this.altoMetros.set(1);
    this.material.set('lona');
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
    const eliminado = this.archivos()[indice];
    this.archivos.update((archivos) => archivos.filter((_, posicion) => posicion !== indice));
    if (eliminado) {
      this.revocarMiniatura(eliminado);
      this.mockups.update((mockups) =>
        mockups.filter((mockup) => mockup.nombre !== eliminado.name),
      );
    }
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
    if (!esFechaEntregaValida(this.form.controls.fechaDeseada.value)) {
      this.paso.set(1);
      this.error.set(MENSAJE_FECHA_MINIMA);
      setTimeout(() => this.enfocarPrimerError());
      return;
    }

    const items = this.carrito();
    const partidasValidas =
      items.length > 0 &&
      items.every((item) => Number(item.cantidad) > 0 && Number(item.precioEstimado ?? 0) > 0);
    if (!partidasValidas || this.totalEstimado() <= 0 || this.totalConIva() <= 0) {
      this.paso.set(2);
      this.error.set(
        'Agrega al menos un producto con cantidad y precio mayor a cero antes de enviar tu solicitud.',
      );
      this.enfocarPaso(2);
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
        mockups: this.mockups(),
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
    this.revocarMiniaturas();
    this.mockups.set([]);
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

  /* --------------------------- Mockup: acciones ---------------------------- */

  openPreview(): void {
    this.selectedMockupIndex.set(0);
    this.showPreviewModal.set(true);
    if (this.modoCalibracion()) this.cargarCalibradorDesdeMockup();
  }

  closePreview(): void {
    this.showPreviewModal.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => {
      this.previewImage.set(typeof lector.result === 'string' ? lector.result : null);
      this.disenoNombre.set(archivo.name);
      this.resetDesignControls();
    };
    lector.readAsDataURL(archivo);
  }

  selectMockup(indice: number): void {
    this.selectedMockupIndex.set(indice);
    if (this.modoCalibracion()) this.cargarCalibradorDesdeMockup();
  }

  setDesignFit(fit: 'contain' | 'cover'): void {
    this.designFit.set(fit);
  }

  resetDesignControls(): void {
    this.designFit.set('contain');
    this.designScale.set(100);
    this.designOffsetX.set(0);
    this.designOffsetY.set(0);
  }

  actualizarNumero(
    destino: 'scale' | 'x' | 'y' | 'top' | 'left' | 'width' | 'height' | 'rx' | 'ry' | 'rz' | 'sy',
    event: Event,
  ): void {
    const valor = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(valor)) return;
    switch (destino) {
      case 'scale':
        this.designScale.set(valor);
        break;
      case 'x':
        this.designOffsetX.set(valor);
        break;
      case 'y':
        this.designOffsetY.set(valor);
        break;
      case 'top':
        this.calTop.set(valor);
        break;
      case 'left':
        this.calLeft.set(valor);
        break;
      case 'width':
        this.calWidth.set(valor);
        break;
      case 'height':
        this.calHeight.set(valor);
        break;
      case 'rx':
        this.calRotateX.set(valor);
        break;
      case 'ry':
        this.calRotateY.set(valor);
        break;
      case 'rz':
        this.calRotateZ.set(valor);
        break;
      case 'sy':
        this.calSkewY.set(valor);
        break;
    }
  }

  toggleCalibracion(): void {
    const activo = !this.modoCalibracion();
    this.modoCalibracion.set(activo);
    if (activo) this.cargarCalibradorDesdeMockup();
  }

  private cargarCalibradorDesdeMockup(): void {
    const vista = this.activeMockup();
    if (!vista) return;
    this.calTop.set(Number.parseFloat(vista.top) || 0);
    this.calLeft.set(Number.parseFloat(vista.left) || 0);
    this.calWidth.set(Number.parseFloat(vista.width) || 30);
    this.calHeight.set(Number.parseFloat(vista.height) || 30);

    const transform = vista.transform ?? '';
    const leer = (funcion: string) => {
      const coincidencia = new RegExp(`${funcion}\\((-?\\d+(?:\\.\\d+)?)deg\\)`).exec(transform);
      return coincidencia ? Number(coincidencia[1]) : 0;
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

  /** Miniatura para adjuntos de imagen; cachea el object URL por archivo. */
  miniatura(archivo: File): string | null {
    if (!archivo.type.startsWith('image/')) return null;
    const existente = this.miniaturas.get(archivo);
    if (existente) return existente;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    try {
      const url = URL.createObjectURL(archivo);
      this.miniaturas.set(archivo, url);
      this.urlsMiniaturas.add(url);
      return url;
    } catch {
      return null;
    }
  }

  private revocarMiniatura(archivo: File): void {
    const url = this.miniaturas.get(archivo);
    if (!url) return;
    this.miniaturas.delete(archivo);
    this.urlsMiniaturas.delete(url);
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* El navegador ya pudo liberarla. */
    }
  }

  private revocarMiniaturas(): void {
    for (const url of this.urlsMiniaturas) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* La URL ya no es válida. */
      }
    }
    this.urlsMiniaturas.clear();
    this.miniaturas = new WeakMap<File, string>();
  }
}
