import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import {
  CategoriaProducto,
  LineaProduccion,
  ProductoApi,
  ProductoPublico,
  UnidadMedida,
} from '../llamma.models';
import { LlammaService } from '../llamma.service';
import { UiService } from '../ui.service';

const LINEAS: { clave: LineaProduccion | ''; etiqueta: string }[] = [
  { clave: '', etiqueta: 'Todas las líneas' },
  { clave: 'gran-formato', etiqueta: 'Gran formato' },
  { clave: 'textil', etiqueta: 'Textil' },
  { clave: 'promocionales', etiqueta: 'Promocionales' },
  { clave: 'papeleria', etiqueta: 'Papelería' },
];

const CATEGORIAS: { valor: CategoriaProducto; etiqueta: string }[] = [
  { valor: 'display', etiqueta: 'Display' },
  { valor: 'senaletica', etiqueta: 'Señalética' },
  { valor: 'rotulacion', etiqueta: 'Rotulación' },
  { valor: 'bastidor', etiqueta: 'Bastidor' },
  { valor: 'textil', etiqueta: 'Textil' },
  { valor: 'promocional', etiqueta: 'Promocional' },
  { valor: 'papeleria', etiqueta: 'Papelería' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const UNIDADES: Record<UnidadMedida, string> = {
  m2: 'm²',
  ml: 'ml',
  pieza: 'pieza',
  hoja: 'hoja',
  kg: 'kg',
  litro: 'litro',
};

const UNIDADES_FORM: Array<{ valor: UnidadMedida; etiqueta: string }> = [
  { valor: 'pieza', etiqueta: 'Pieza' },
  { valor: 'm2', etiqueta: 'Metro cuadrado (m²)' },
  { valor: 'ml', etiqueta: 'Metro lineal (ml)' },
  { valor: 'hoja', etiqueta: 'Hoja' },
  { valor: 'kg', etiqueta: 'Kilogramo' },
  { valor: 'litro', etiqueta: 'Litro' },
];

/** Catálogo público con gestión interna para admin y ventas. */
@Component({
  selector: 'app-productos',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductosComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly productos = signal<ProductoPublico[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly linea = signal<LineaProduccion | ''>('');
  readonly busqueda = signal('');

  readonly lineas = LINEAS;
  readonly categorias = CATEGORIAS;
  readonly unidadesForm = UNIDADES_FORM;

  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'ventas'));

  readonly gestionAbierta = signal(false);
  readonly vista = signal<'lista' | 'formulario'>('lista');
  readonly admin = signal<ProductoApi[]>([]);
  readonly cargandoAdmin = signal(false);
  readonly busquedaAdmin = signal('');
  readonly editando = signal<ProductoApi | null>(null);
  readonly guardando = signal(false);
  readonly cambiandoId = signal<number | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    categoria: ['otro' as CategoriaProducto, [Validators.required]],
    lineaProduccion: ['gran-formato' as LineaProduccion, [Validators.required]],
    precioBase: [0, [Validators.required, Validators.min(0)]],
    unidadVenta: ['pieza' as UnidadMedida, [Validators.required]],
    icono: ['bi-box-seam'],
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
    this.cargarPublico();
  }

  cargarPublico(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.listarProductosPublicos().subscribe({
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
        this.cargarPublico();
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
          this.cargarPublico();
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cambiar la publicación.')),
      });
  }

  alternarActivo(producto: ProductoApi): void {
    if (producto.activo) {
      if (
        !window.confirm(
          `¿Dar de baja ${producto.nombre}? Se ocultará del catálogo pero conservará su historial.`,
        )
      )
        return;
      this.cambiandoId.set(producto.id);
      this.service
        .desactivarProducto(producto.id)
        .pipe(finalize(() => this.cambiandoId.set(null)))
        .subscribe({
          next: () => {
            this.ui.exito('Producto dado de baja.');
            this.cargarAdmin();
            this.cargarPublico();
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
          this.cargarPublico();
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos reactivar el producto.')),
      });
  }

  private actualizarEnLista(producto: ProductoApi): void {
    this.admin.update((lista) =>
      lista.map((fila) => (fila.id === producto.id ? producto : fila)),
    );
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  unidad(unidad: UnidadMedida): string {
    return UNIDADES[unidad] ?? unidad;
  }

  etiquetaLinea(linea: LineaProduccion | string): string {
    return LINEAS.find((opcion) => opcion.clave === linea)?.etiqueta ?? linea;
  }

  etiquetaCategoria(categoria: string): string {
    return CATEGORIAS.find((opcion) => opcion.valor === categoria)?.etiqueta ?? categoria;
  }
}
