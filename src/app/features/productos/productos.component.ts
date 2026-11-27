import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import {
  CATEGORIAS_PRODUCTO,
  LINEAS_PRODUCCION,
  UNIDADES,
  etiquetaDe,
  mapaCortas,
} from '../../core/models/estados';
import {
  CategoriaProducto,
  LineaProduccion,
  ProductoApi,
  ProductoPublico,
  UnidadMedida,
} from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { ModalAccesibleDirective } from '../../shared/modal-accesible.directive';
import { UiService } from '../../core/services/ui.service';

const LINEAS: { valor: LineaProduccion | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas las líneas' },
  ...LINEAS_PRODUCCION,
];

const UNIDAD_CORTA = mapaCortas(UNIDADES);

/**
 * Alias aceptados en `?linea=` para tolerar enlaces antiguos, nombres largos,
 * mayúsculas y tildes sin romper el filtro.
 */
const ALIAS_LINEA: Record<string, LineaProduccion | ''> = {
  'gran-formato': 'gran-formato',
  'gran-formato-y-displays': 'gran-formato',
  'gran-formato-displays': 'gran-formato',
  'gran-formato-y-display': 'gran-formato',
  display: 'gran-formato',
  senaletica: 'gran-formato',
  rotulacion: 'gran-formato',
  bastidor: 'gran-formato',
  textil: 'textil',
  'linea-textil': 'textil',
  'sublimacion-dtf': 'textil',
  'sublimacion-y-dtf': 'textil',
  promocionales: 'promocionales',
  promocional: 'promocionales',
  'articulos-promocionales': 'promocionales',
  'sublimacion-3d': 'promocionales',
  papeleria: 'papeleria',
  'papeleria-creativa': 'papeleria',
  'acabados-especiales': 'papeleria',
  todas: '',
  'todas-las-lineas': '',
  all: '',
  '': '',
};

function normalizarLinea(valor: string | null | undefined): LineaProduccion | '' {
  if (!valor) return '';
  const clave = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ALIAS_LINEA[clave] ?? '';
}

/** Catálogo público con gestión interna para admin y ventas. */
@Component({
  selector: 'app-productos',
  imports: [ReactiveFormsModule, RouterLink, ModalAccesibleDirective],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductosComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  readonly productos = signal<ProductoPublico[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly linea = signal<LineaProduccion | ''>('');
  readonly busqueda = signal('');

  readonly lineas = LINEAS;
  readonly categorias = CATEGORIAS_PRODUCTO;
  readonly unidadesForm = UNIDADES;

  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'ventas'));

  readonly gestionAbierta = signal(false);
  readonly vista = signal<'lista' | 'formulario'>('lista');
  readonly admin = signal<ProductoApi[]>([]);
  readonly cargandoAdmin = signal(false);
  readonly busquedaAdmin = signal('');
  readonly editando = signal<ProductoApi | null>(null);
  readonly guardando = signal(false);
  readonly cambiandoId = signal<number | null>(null);
  readonly imagenesConError = signal<ReadonlySet<number>>(new Set());

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    categoria: ['otro' as CategoriaProducto, [Validators.required]],
    lineaProduccion: ['gran-formato' as LineaProduccion, [Validators.required]],
    precioBase: [0, [Validators.required, Validators.min(0)]],
    unidadVenta: ['pieza' as UnidadMedida, [Validators.required]],
    icono: ['bi-box-seam'],
    imagenUrl: [''],
    publicado: [true],
    activo: [true],
  });

  readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.productos().filter((producto) => {
      const coincideLinea = !this.linea() || producto.lineaProduccion === this.linea();
      const coincideTexto =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        (producto.descripcion ?? '').toLowerCase().includes(texto);
      return coincideLinea && coincideTexto;
    });
  });

  readonly filtradosAdmin = computed(() => {
    const texto = this.busquedaAdmin().trim().toLowerCase();
    if (!texto) return this.admin();
    return this.admin().filter((producto) =>
      [producto.nombre, producto.descripcion ?? '', producto.categoria, producto.lineaProduccion]
        .join(' ')
        .toLowerCase()
        .includes(texto),
    );
  });

  readonly resumenAdmin = computed(() => {
    const lista = this.admin();
    return {
      total: lista.length,
      publicados: lista.filter((producto) => producto.publicado && producto.activo).length,
      borradores: lista.filter((producto) => !producto.publicado && producto.activo).length,
      inactivos: lista.filter((producto) => !producto.activo).length,
    };
  });

  ngOnInit(): void {
    const termino = this.route.snapshot.queryParamMap.get('q');
    if (termino) this.busqueda.set(termino);

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const solicitada = params.get('linea') ?? params.get('categoria');
      this.linea.set(normalizarLinea(solicitada));
    });

    this.cargarPublico();
  }

  cargarPublico(refrescar = false): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listarProductosPublicos(refrescar).subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.items);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar el catálogo. Intenta de nuevo en un momento.');
        this.cargando.set(false);
      },
    });
  }

  filtrarPor(linea: LineaProduccion | ''): void {
    this.linea.set(linea);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { linea: linea || null },
      queryParamsHandling: 'merge',
    });
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  abrirGestion(): void {
    this.gestionAbierta.set(true);
    this.vista.set('lista');
    this.busquedaAdmin.set('');
    this.editando.set(null);
    this.cargarAdmin();
  }

  cerrarGestion(): void {
    this.gestionAbierta.set(false);
    this.vista.set('lista');
    this.editando.set(null);
  }

  cargarAdmin(): void {
    this.cargandoAdmin.set(true);
    this.service
      .listarProductos()
      .pipe(finalize(() => this.cargandoAdmin.set(false)))
      .subscribe({
        next: (respuesta) => this.admin.set(respuesta.items),
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cargar los productos internos.')),
      });
  }

  actualizarBusquedaAdmin(evento: Event): void {
    this.busquedaAdmin.set((evento.target as HTMLInputElement).value);
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({
      nombre: '',
      descripcion: '',
      categoria: 'otro',
      lineaProduccion: 'gran-formato',
      precioBase: 0,
      unidadVenta: 'pieza',
      icono: 'bi-box-seam',
      imagenUrl: '',
      publicado: true,
      activo: true,
    });
    this.vista.set('formulario');
  }

  abrirEditar(producto: ProductoApi): void {
    this.editando.set(producto);
    this.formulario.reset({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      categoria: producto.categoria,
      lineaProduccion: producto.lineaProduccion,
      precioBase: Number(producto.precioBase ?? 0),
      unidadVenta: producto.unidadVenta,
      icono: producto.icono ?? 'bi-box-seam',
      imagenUrl: producto.imagenUrl ?? '',
      publicado: producto.publicado,
      activo: producto.activo,
    });
    this.vista.set('formulario');
  }

  volverLista(): void {
    this.vista.set('lista');
    this.editando.set(null);
  }

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const valores = this.formulario.getRawValue();
    const body: Record<string, unknown> = {
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() || null,
      categoria: valores.categoria,
      lineaProduccion: valores.lineaProduccion,
      precioBase: Number(valores.precioBase),
      unidadVenta: valores.unidadVenta,
      icono: valores.icono.trim() || 'bi-box-seam',
      imagenUrl: valores.imagenUrl.trim() || null,
      publicado: valores.publicado,
      activo: valores.activo,
    };
    const edicion = this.editando();
    this.guardando.set(true);
    const peticion = edicion
      ? this.service.actualizarProducto(edicion.id, body)
      : this.service.crearProducto(body);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: () => {
        this.ui.exito(edicion ? 'Producto actualizado.' : 'Producto creado.');
        this.volverLista();
        this.cargarAdmin();
        this.cargarPublico(true);
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos guardar el producto.')),
    });
  }

  alternarPublicado(producto: ProductoApi): void {
    this.cambiandoId.set(producto.id);
    this.service
      .actualizarProducto(producto.id, { publicado: !producto.publicado })
      .pipe(finalize(() => this.cambiandoId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.actualizarEnLista(actualizado);
          this.ui.exito(
            actualizado.publicado
              ? `${actualizado.nombre} ya aparece en el catálogo.`
              : `${actualizado.nombre} se ocultó del catálogo.`,
          );
          this.cargarPublico(true);
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cambiar la publicación.')),
      });
  }

  async alternarActivo(producto: ProductoApi): Promise<void> {
    if (producto.activo) {
      const confirmado = await this.confirmacion.confirmar({
        titulo: 'Dar de baja producto',
        mensaje: `¿Dar de baja ${producto.nombre}? Se ocultará del catálogo pero conservará su historial.`,
        confirmar: 'Dar de baja',
        peligro: true,
      });
      if (!confirmado) return;

      this.cambiandoId.set(producto.id);
      this.service
        .desactivarProducto(producto.id)
        .pipe(finalize(() => this.cambiandoId.set(null)))
        .subscribe({
          next: () => {
            this.ui.exito('Producto dado de baja.');
            this.cargarAdmin();
            this.cargarPublico(true);
          },
          error: (error) =>
            this.ui.error(this.ui.mensajeDeError(error, 'No pudimos dar de baja el producto.')),
        });
      return;
    }

    this.cambiandoId.set(producto.id);
    this.service
      .actualizarProducto(producto.id, { activo: true })
      .pipe(finalize(() => this.cambiandoId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.actualizarEnLista(actualizado);
          this.ui.exito('Producto reactivado.');
          this.cargarPublico(true);
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos reactivar el producto.')),
      });
  }

  private actualizarEnLista(producto: ProductoApi): void {
    this.admin.update((lista) => lista.map((fila) => (fila.id === producto.id ? producto : fila)));
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  unidad(unidad: UnidadMedida): string {
    return UNIDAD_CORTA[unidad] ?? unidad;
  }

  /** Si la foto no existe o está rota, la tarjeta vuelve al icono. */
  marcarImagenRota(id: number): void {
    this.imagenesConError.update((actuales) => new Set(actuales).add(id));
  }

  etiquetaLinea(linea: LineaProduccion | string): string {
    return etiquetaDe(LINEAS, linea);
  }

  etiquetaCategoria(categoria: string): string {
    return etiquetaDe(CATEGORIAS_PRODUCTO, categoria);
  }
}
