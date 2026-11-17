import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import {
  MateriaPrimaApi,
  OrdenCompraApi,
  ProveedorApi,
} from '../llamma.models';
import { LlammaService } from '../llamma.service';
import { UiService } from '../ui.service';

const ESTADOS: { valor: string; etiqueta: string; badge: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente', badge: 'badge-soft-muted' },
  { valor: 'confirmada', etiqueta: 'Confirmada', badge: 'badge-soft-warning' },
  { valor: 'en-transito', etiqueta: 'En tránsito', badge: 'badge-soft-cyan' },
  { valor: 'recibida', etiqueta: 'Recibida', badge: 'badge-soft-success' },
  { valor: 'cancelada', etiqueta: 'Cancelada', badge: 'badge-soft-danger' },
];

const ABIERTOS = new Set(['pendiente', 'confirmada', 'en-transito']);

const ICONO_CATEGORIA: Record<string, string> = {
  lona: 'bi-layers',
  vinil: 'bi-square',
  tinta: 'bi-droplet-half',
  papel: 'bi-file-earmark-text',
  herrajes: 'bi-disc',
  estructura: 'bi-bounding-box',
  lamina: 'bi-grid-3x3',
  laminado: 'bi-arrow-repeat',
  adhesivo: 'bi-stickies',
  perfil: 'bi-bounding-box-circles',
  textil: 'bi-bag',
  promocional: 'bi-gift',
  otro: 'bi-box-seam',
};

const UNIDADES: Record<string, string> = {
  m2: 'm²',
  ml: 'ml',
  pieza: 'pza',
  hoja: 'hoja',
  kg: 'kg',
  litro: 'L',
};

@Component({
  selector: 'app-abastecimiento',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './abastecimiento.component.html',
  styleUrl: './abastecimiento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbastecimientoComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly estados = ESTADOS;

  readonly ordenes = signal<OrdenCompraApi[]>([]);
  readonly materias = signal<MateriaPrimaApi[]>([]);
  readonly proveedores = signal<ProveedorApi[]>([]);
  readonly cargando = signal(true);
  readonly cargandoCatalogos = signal(true);
  readonly error = signal<string | null>(null);
  readonly pagina = signal(1);
  readonly porPagina = 8;

  readonly ordenAbierta = signal(false);
  readonly guardando = signal(false);
  readonly detalle = signal<OrdenCompraApi | null>(null);
  readonly cambiandoEstado = signal(false);
  readonly proveedorAbierto = signal(false);
  readonly guardandoProveedor = signal(false);

  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'inventario'));

  readonly filtros = this.fb.nonNullable.group({ q: [''], estado: [''] });

  readonly ordenForm = this.fb.group({
    proveedorId: ['', [Validators.required]],
    estado: ['pendiente'],
    fechaEntrega: [this.enDias(7)],
    notas: [''],
    items: this.fb.array<FormGroup>([]),
  });

  readonly proveedorForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    contacto: [''],
    telefono: [''],
    correo: ['', [Validators.email]],
    condicionesPago: [''],
  });

  readonly filtradas = computed(() => {
    const { q, estado } = this.filtros.getRawValue();
    const termino = q.trim().toLowerCase();
    return this.ordenes().filter((orden) => {
      if (estado && orden.estado !== estado) return false;
      if (!termino) return true;
      const items = orden.items.map((item) => item.materiaPrima ?? '').join(' ');
      return [orden.folio, orden.proveedor ?? '', items].join(' ').toLowerCase().includes(termino);
    });
  });

  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / this.porPagina)));

  readonly visibles = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina;
    return this.filtradas().slice(inicio, inicio + this.porPagina);
  });

  readonly listaPaginas = computed(() => {
    const total = this.paginas();
    const actual = this.pagina();
    const desde = Math.max(1, actual - 2);
    const hasta = Math.min(total, desde + 4);
    return Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);
  });

  readonly estadisticas = computed(() => {
    const ordenes = this.ordenes();
    const abiertas = ordenes.filter((orden) => ABIERTOS.has(orden.estado));
    const comprometido = abiertas.reduce((total, orden) => total + Number(orden.total ?? 0), 0);
    const proveedoresActivos = this.proveedores().filter((proveedor) => proveedor.activo).length;
    const recibidas = ordenes.filter((orden) => orden.estado === 'recibida').length;
    return [
      {
        icono: 'bi-file-earmark-text',
        tono: 'icon-tile-cyan',
        valor: this.dosDigitos(abiertas.length),
        etiqueta: 'Órdenes de compra abiertas',
      },
      {
        icono: 'bi-cash-coin',
        tono: 'icon-tile-magenta',
        valor: this.moneda(comprometido),
        etiqueta: 'Monto comprometido',
      },
      {
        icono: 'bi-truck',
        tono: 'icon-tile-yellow',
        valor: this.dosDigitos(proveedoresActivos),
        etiqueta: 'Proveedores activos',
      },
      {
        icono: 'bi-check2-circle',
        tono: 'icon-tile-success',
        valor: this.dosDigitos(recibidas),
        etiqueta: 'Órdenes recibidas',
      },
    ];
  });

  readonly sugerencias = computed(() =>
    this.materias()
      .filter((materia) => materia.bajoStock || materia.stockActual <= materia.stockMinimo)
      .map((materia) => {
        const objetivo = Math.max(materia.stockMaximo, materia.stockMinimo * 2, materia.stockActual);
        const reposicion = Math.max(objetivo - materia.stockActual, 0);
        const critico =
          materia.stockActual <= 0 ||
          (materia.stockMinimo > 0 && materia.stockActual <= materia.stockMinimo * 0.5);
        return {
          materia,
          reposicion,
          critico,
          icono: ICONO_CATEGORIA[materia.categoria] ?? 'bi-box-seam',
          tono: critico ? 'icon-tile-danger' : 'icon-tile-warning',
        };
      })
      .sort((a, b) => Number(b.critico) - Number(a.critico)),
  );

  readonly recepciones = computed(() =>
    this.ordenes()
      .filter((orden) => ABIERTOS.has(orden.estado) && orden.fechaEntrega)
      .sort((a, b) => String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)))
      .slice(0, 5),
  );

  readonly resumenAlerta = computed(() => {
    const sugerencias = this.sugerencias();
    return {
      total: sugerencias.length,
      criticos: sugerencias.filter((fila) => fila.critico).length,
      nombres: sugerencias
        .slice(0, 3)
        .map((fila) => fila.materia.nombre)
        .join(', '),
    };
  });

  readonly totalesFormulario = computed(() => {
    const items = this.itemsArray.getRawValue() as Array<{
      cantidad: number | string;
      precioUnitario: number | string;
    }>;
    const subtotal = items.reduce(
      (total, item) => total + Number(item.cantidad || 0) * Number(item.precioUnitario || 0),
      0,
    );
    const impuestos = subtotal * 0.16;
    return {
      subtotal,
      impuestos,
      total: subtotal + impuestos,
      partidas: items.filter((item) => Number(item.cantidad) > 0).length,
    };
  });

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  get itemsArray(): FormArray {
    return this.ordenForm.controls.items as FormArray;
  }

  private crearItem(materia?: MateriaPrimaApi): FormGroup {
    return this.fb.group({
      materiaPrimaId: [materia ? String(materia.id) : '', [Validators.required]],
      cantidad: [0, [Validators.required, Validators.min(0.01)]],
      precioUnitario: [
        materia ? materia.costoUnitario : 0,
        [Validators.required, Validators.min(0)],
      ],
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service
      .listarOrdenesCompra({ page: 1, perPage: 100 })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.ordenes.set(respuesta.items);
          const paginas = Math.max(1, Math.ceil(this.filtradas().length / this.porPagina));
          if (this.pagina() > paginas) this.pagina.set(paginas);
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar las órdenes de compra.'));
        },
      });
  }

  cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.service.listarMaterias().subscribe({
      next: (respuesta) => this.materias.set(respuesta.items),
      error: () => this.materias.set([]),
    });
    this.service
      .listarProveedores()
      .pipe(finalize(() => this.cargandoCatalogos.set(false)))
      .subscribe({
        next: (respuesta) => this.proveedores.set(respuesta.items),
        error: () => this.proveedores.set([]),
      });
  }

  filtrar(): void {
    this.pagina.set(1);
  }

  limpiar(): void {
    this.filtros.reset({ q: '', estado: '' });
    this.pagina.set(1);
  }

  irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.paginas()));
  }

  abrirNueva(proveedorId?: number): void {
    this.ordenForm.reset({
      proveedorId: proveedorId ? String(proveedorId) : '',
      estado: 'pendiente',
      fechaEntrega: this.enDias(7),
      notas: '',
    });
    this.itemsArray.clear();
    const primera = proveedorId
      ? this.materias().find((materia) => materia.proveedorId === proveedorId)
      : this.materias()[0];
    this.itemsArray.push(this.crearItem(primera));
    this.proveedorAbierto.set(false);
    this.ordenAbierta.set(true);
  }

  cerrarNueva(): void {
    this.ordenAbierta.set(false);
  }

  agregarItem(): void {
    const usados = new Set(
      (this.itemsArray.getRawValue() as Array<{ materiaPrimaId: string }>).map((item) =>
        String(item.materiaPrimaId),
      ),
    );
    const disponible = this.materias().find((materia) => !usados.has(String(materia.id)));
    this.itemsArray.push(this.crearItem(disponible));
  }

  quitarItem(indice: number): void {
    if (this.itemsArray.length <= 1) {
      this.ui.info('La orden necesita al menos una partida.');
      return;
    }
    this.itemsArray.removeAt(indice);
  }

  actualizarPrecio(indice: number): void {
    const grupo = this.itemsArray.at(indice);
    const materia = this.materias().find(
      (fila) => String(fila.id) === String(grupo.get('materiaPrimaId')?.value),
    );
    if (materia) {
      grupo.get('precioUnitario')?.setValue(materia.costoUnitario);
    }
  }

  materiaDe(indice: number): MateriaPrimaApi | undefined {
    const grupo = this.itemsArray.at(indice);
    return this.materias().find(
      (fila) => String(fila.id) === String(grupo.get('materiaPrimaId')?.value),
    );
  }

  crearOrden(): void {
    if (this.ordenForm.invalid) {
      this.ordenForm.markAllAsTouched();
      return;
    }
    const valores = this.ordenForm.getRawValue();
    const items = (valores.items ?? []) as Array<{
      materiaPrimaId: string;
      cantidad: number;
      precioUnitario: number;
    }>;
    const partidas = items
      .filter((item) => item.materiaPrimaId && Number(item.cantidad) > 0)
      .map((item) => ({
        materiaPrimaId: Number(item.materiaPrimaId),
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
      }));

    if (!partidas.length) {
      this.ui.error('Agrega al menos una partida con cantidad mayor a cero.');
      return;
    }

    this.guardando.set(true);
    this.service
      .crearOrdenCompra({
        proveedorId: Number(valores.proveedorId),
        estado: valores.estado,
        fechaEntrega: valores.fechaEntrega || null,
        notas: valores.notas?.trim() || null,
        items: partidas,
      })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (orden) => {
          this.ui.exito(`Orden ${orden.folio} creada con ${partidas.length} partidas.`);
          this.cerrarNueva();
          this.cargar();
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos crear la orden de compra.')),
      });
  }

  abrirDetalle(orden: OrdenCompraApi): void {
    this.detalle.set(orden);
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  recibir(orden: OrdenCompraApi): void {
    const piezas = orden.items.length;
    if (
      !window.confirm(
        `¿Marcar ${orden.folio} como recibida? Se sumarán ${piezas} partidas al inventario y se registrarán los movimientos de entrada.`,
      )
    )
      return;
    this.cambiarEstadoOrden(orden, 'recibida');
  }

  cambiarEstado(evento: Event, orden: OrdenCompraApi): void {
    const estado = (evento.target as HTMLSelectElement).value;
    if (estado === orden.estado) return;
    if (estado === 'recibida') {
      (evento.target as HTMLSelectElement).value = orden.estado;
      this.recibir(orden);
      return;
    }
    this.cambiarEstadoOrden(orden, estado);
  }

  private cambiarEstadoOrden(orden: OrdenCompraApi, estado: string): void {
    this.cambiandoEstado.set(true);
    this.service
      .cambiarEstadoOrdenCompra(orden.id, estado)
      .pipe(finalize(() => this.cambiandoEstado.set(false)))
      .subscribe({
        next: (actualizada) => {
          this.ordenes.update((lista) =>
            lista.map((fila) => (fila.id === actualizada.id ? actualizada : fila)),
          );
          if (this.detalle()?.id === actualizada.id) this.detalle.set(actualizada);
          const etiqueta = this.etiquetaEstado(actualizada.estado);
          this.ui.exito(`Orden ${actualizada.folio}: ${etiqueta}.`);
          if (estado === 'recibida') this.cargarCatalogos();
          this.cargar();
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cambiar el estado de la orden.')),
      });
  }

  abrirProveedor(): void {
    this.proveedorForm.reset({
      nombre: '',
      contacto: '',
      telefono: '',
      correo: '',
      condicionesPago: '',
    });
    this.proveedorAbierto.set(true);
  }

  cerrarProveedor(): void {
    this.proveedorAbierto.set(false);
  }

  guardarProveedor(): void {
    if (this.proveedorForm.invalid) {
      this.proveedorForm.markAllAsTouched();
      return;
    }
    this.guardandoProveedor.set(true);
    this.service
      .crearProveedor(this.proveedorForm.getRawValue())
      .pipe(finalize(() => this.guardandoProveedor.set(false)))
      .subscribe({
        next: (proveedor) => {
          this.proveedores.update((lista) => [...lista, proveedor]);
          this.cerrarProveedor();
          this.ui.exito(`Proveedor ${proveedor.nombre} registrado.`);
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos registrar el proveedor.')),
      });
  }

  generarConsolidada(): void {
    const sugerencias = this.sugerencias();
    if (!sugerencias.length) {
      this.ui.info('No hay insumos por debajo de su punto de reorden.');
      return;
    }
    const grupos = new Map<number, typeof sugerencias>();
    for (const sugerencia of sugerencias) {
      const clave = sugerencia.materia.proveedorId ?? 0;
      grupos.set(clave, [...(grupos.get(clave) ?? []), sugerencia]);
    }
    const [proveedorId, elegidas] = [...grupos.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )[0];
    this.abrirNueva(proveedorId);
    if (elegidas.length) {
      this.itemsArray.clear();
      for (const fila of elegidas) {
        const grupo = this.crearItem(fila.materia);
        grupo.get('cantidad')?.setValue(Math.round(fila.reposicion * 100) / 100);
        this.itemsArray.push(grupo);
      }
    }
    this.ui.info(
      proveedorId
        ? 'Orden consolidada preparada con las partidas sugeridas del proveedor.'
        : 'Orden preparada. Asigna un proveedor a los insumos para agrupar compras.',
    );
  }

  exportar(): void {
    const filas = [
      ['Folio', 'Proveedor', 'Estado', 'Emisión', 'Entrega', 'Partidas', 'Total'],
      ...this.filtradas().map((orden) => [
        orden.folio,
        orden.proveedor ?? '',
        this.etiquetaEstado(orden.estado),
        orden.fechaEmision ?? '',
        orden.fechaEntrega ?? '',
        String(orden.items.length),
        String(orden.total),
      ]),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'ordenes-compra-llamma.csv';
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Órdenes de compra exportadas en CSV.');
  }

  etiquetaEstado(estado: string): string {
    return ESTADOS.find((fila) => fila.valor === estado)?.etiqueta ?? estado;
  }

  claseEstado(estado: string): string {
    return ESTADOS.find((fila) => fila.valor === estado)?.badge ?? 'badge-soft-muted';
  }

  etiquetaItems(orden: OrdenCompraApi): string {
    if (!orden.items.length) return 'Sin partidas';
    const primero = orden.items[0];
    const extra = orden.items.length - 1;
    const detalle = `${primero.materiaPrima ?? 'Insumo'} · ${this.cantidad(
      primero.cantidad,
      primero.unidadMedida,
    )}`;
    return extra > 0 ? `${detalle} +${extra} más` : detalle;
  }

  importeItem(indice: number): number {
    const grupo = this.itemsArray.at(indice);
    return (
      Number(grupo.get('cantidad')?.value || 0) * Number(grupo.get('precioUnitario')?.value || 0)
    );
  }

  unidadItem(indice: number): string {
    return this.materiaDe(indice)?.unidadMedida ?? 'pieza';
  }

  cantidad(valor: number, unidad?: string): string {
    const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(
      Number(valor ?? 0),
    );
    return unidad ? `${numero} ${UNIDADES[unidad] ?? unidad}` : numero;
  }

  iniciales(nombre: string | null | undefined): string {
    return (nombre || 'PR')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase();
  }

  avatar(indice: number): string {
    return ['avatar-cyan', 'avatar-magenta', 'avatar-yellow', 'avatar-ink'][indice % 4];
  }

  avatarProveedor(nombre: string | null | undefined): string {
    const codigo = this.iniciales(nombre);
    const suma = codigo.split('').reduce((total, letra) => total + letra.charCodeAt(0), 0);
    return this.avatar(suma);
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  monedaExacta(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(valor ?? 0));
  }

  fechaCorta(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    if (!fecha) return 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  diaRecepcion(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    return fecha ? String(fecha.getDate()).padStart(2, '0') : '—';
  }

  mesRecepcion(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    return fecha
      ? fecha.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase()
      : '—';
  }

  rangoTexto(): string {
    const total = this.filtradas().length;
    const inicio = total ? (this.pagina() - 1) * this.porPagina + 1 : 0;
    return `Mostrando ${inicio}–${Math.min(this.pagina() * this.porPagina, total)} de ${total} órdenes`;
  }

  private aFecha(valor: string | null | undefined): Date | null {
    if (!valor) return null;
    const fecha = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private dosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }

  private enDias(dias: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }
}
