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

import { AuthService } from '../../core/services/auth.service';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import { CATEGORIAS_MATERIA, TIPOS_MOVIMIENTO, UNIDADES } from '../../core/models/estados';
import {
  CategoriaMateriaPrima,
  ComponenteReceta,
  MateriaPrimaApi,
  MovimientoApi,
  ProductoConReceta,
  ProveedorApi,
  TipoMovimiento,
  UnidadMedida,
} from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { ModalAccesibleDirective } from '../../shared/modal-accesible.directive';
import { UiService } from '../../core/services/ui.service';

const TONO_CATEGORIA: Record<string, string> = {
  lona: 'icon-tile-cyan',
  vinil: 'icon-tile-cyan',
  tinta: 'icon-tile-magenta',
  papel: 'icon-tile-ink',
  herrajes: 'icon-tile-ink',
  estructura: 'icon-tile-yellow',
  lamina: 'icon-tile-cyan',
  laminado: 'icon-tile-cyan',
  adhesivo: 'icon-tile-cyan',
  perfil: 'icon-tile-yellow',
  textil: 'icon-tile-magenta',
  promocional: 'icon-tile-magenta',
  otro: 'icon-tile-ink',
};

type ClaveEstado = 'critico' | 'bajo' | 'optimo';

interface EstadoStock {
  clave: ClaveEstado;
  etiqueta: string;
  badge: string;
  barra: string;
  texto: string;
  porcentaje: number;
}

@Component({
  selector: 'app-inventario',
  imports: [ReactiveFormsModule, RouterLink, ModalAccesibleDirective],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventarioComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly categorias = CATEGORIAS_MATERIA;
  readonly unidades = UNIDADES;
  readonly tiposMovimiento = TIPOS_MOVIMIENTO;

  readonly materias = signal<MateriaPrimaApi[]>([]);
  readonly movimientos = signal<MovimientoApi[]>([]);
  readonly proveedores = signal<ProveedorApi[]>([]);
  readonly productosInsumos = signal<ProductoConReceta[]>([]);
  readonly vistaActual = signal<'tarjetas' | 'tabla'>('tarjetas');
  readonly cargando = signal(true);
  readonly cargandoInsumos = signal(true);
  readonly cargandoMovimientos = signal(true);
  readonly error = signal<string | null>(null);
  readonly pagina = signal(1);
  readonly porPagina = 8;

  readonly formularioAbierto = signal(false);
  readonly editando = signal<MateriaPrimaApi | null>(null);
  readonly guardando = signal(false);
  readonly ajusteAbierto = signal(false);
  readonly materiaAjuste = signal<MateriaPrimaApi | null>(null);
  readonly ajustando = signal(false);

  readonly puedeGestionar = computed(() => this.auth.puedeEditarInventario());

  readonly filtros = this.fb.nonNullable.group({
    q: [''],
    categoria: [''],
    estado: [''],
  });

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    categoria: ['otro' as CategoriaMateriaPrima, [Validators.required]],
    unidadMedida: ['pieza' as UnidadMedida, [Validators.required]],
    stockActual: [0, [Validators.required, Validators.min(0)]],
    stockMinimo: [0, [Validators.required, Validators.min(0)]],
    stockMaximo: [0, [Validators.required, Validators.min(0)]],
    costoUnitario: [0, [Validators.required, Validators.min(0)]],
    proveedorId: [''],
  });

  readonly ajusteForm = this.fb.nonNullable.group({
    materiaId: ['', [Validators.required]],
    tipo: ['entrada' as TipoMovimiento, [Validators.required]],
    cantidad: [0, [Validators.required, Validators.min(0.0001)]],
    referencia: [''],
    motivo: [''],
  });

  readonly filtradas = computed(() => {
    const { q, categoria, estado } = this.filtros.getRawValue();
    const termino = q.trim().toLowerCase();
    return this.materias().filter((materia) => {
      if (categoria && materia.categoria !== categoria) return false;
      if (estado && this.estadoStock(materia).clave !== estado) return false;
      if (!termino) return true;
      const etiqueta = this.etiquetaCategoria(materia.categoria).toLowerCase();
      return [materia.nombre, materia.proveedor ?? '', etiqueta, materia.categoria]
        .join(' ')
        .toLowerCase()
        .includes(termino);
    });
  });

  readonly paginas = computed(() =>
    Math.max(1, Math.ceil(this.filtradas().length / this.porPagina)),
  );

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
    const materias = this.materias();
    const valor = materias.reduce(
      (total, materia) => total + materia.stockActual * materia.costoUnitario,
      0,
    );
    const criticos = materias.filter((m) => this.estadoStock(m).clave === 'critico').length;
    const proveedores = new Set(
      materias.map((materia) => materia.proveedorId).filter((id) => id != null),
    ).size;
    return [
      {
        icono: 'bi-cash-stack',
        tono: 'icon-tile-cyan',
        valor: this.moneda(valor),
        etiqueta: 'Valor del inventario',
      },
      {
        icono: 'bi-boxes',
        tono: 'icon-tile-magenta',
        valor: String(materias.length),
        etiqueta: 'Insumos controlados',
      },
      {
        icono: 'bi-exclamation-octagon',
        tono: criticos ? 'icon-tile-danger' : 'icon-tile-success',
        valor: this.dosDigitos(criticos),
        etiqueta: 'Insumos críticos',
      },
      {
        icono: 'bi-truck',
        tono: 'icon-tile-yellow',
        valor: this.dosDigitos(proveedores),
        etiqueta: 'Proveedores con suministro',
      },
    ];
  });

  readonly resumenAlerta = computed(() => {
    const criticos = this.materias().filter((m) => this.estadoStock(m).clave === 'critico');
    const bajos = this.materias().filter((m) => this.estadoStock(m).clave === 'bajo');
    const nombres = criticos.slice(0, 2).map((m) => m.nombre);
    return {
      criticos: criticos.length,
      bajos: bajos.length,
      nombres: nombres.join(' y '),
      total: criticos.length + bajos.length,
    };
  });

  readonly sugerencias = computed(() =>
    this.materias()
      .filter((materia) => this.estadoStock(materia).clave !== 'optimo')
      .map((materia) => {
        const estado = this.estadoStock(materia);
        const objetivo = Math.max(
          materia.stockMaximo,
          materia.stockMinimo * 2,
          materia.stockActual,
        );
        return {
          materia,
          estado,
          reposicion: Math.max(objetivo - materia.stockActual, 0),
          icono: this.iconoCategoria(materia.categoria),
        };
      })
      .sort((a, b) => a.estado.porcentaje - b.estado.porcentaje),
  );

  readonly movimientosRecientes = computed(() => this.movimientos().slice(0, 8));

  readonly vistaPreviaAjuste = computed(() => {
    const valores = this.ajusteForm.getRawValue();
    const materia = this.materias().find((m) => m.id === Number(valores.materiaId));
    if (!materia) return null;
    const cantidad = Number(valores.cantidad) || 0;
    const actual = materia.stockActual;
    let resultado = actual;
    if (valores.tipo === 'entrada' || valores.tipo === 'devolucion') resultado = actual + cantidad;
    else if (valores.tipo === 'salida' || valores.tipo === 'merma')
      resultado = Math.max(actual - cantidad, 0);
    else resultado = Math.max(cantidad, 0);
    return { materia, resultado };
  });

  ngOnInit(): void {
    this.cargar();
    this.cargarInsumos();
    this.cargarMovimientos();
    this.cargarProveedores();
  }

  cargarInsumos(): void {
    this.cargandoInsumos.set(true);
    this.service
      .listarInsumosPorProducto()
      .pipe(finalize(() => this.cargandoInsumos.set(false)))
      .subscribe({
        next: (respuesta) => this.productosInsumos.set(respuesta.items),
        error: (error) => {
          this.productosInsumos.set([]);
          this.ui.error(
            this.ui.mensajeDeError(error, 'No pudimos cargar los insumos por producto.'),
          );
        },
      });
  }

  cambiarVista(vista: 'tarjetas' | 'tabla'): void {
    this.vistaActual.set(vista);
  }

  reponer(componente: ComponenteReceta): void {
    const materia = this.materias().find((item) => item.id === componente.materiaPrimaId);
    if (!materia) {
      this.ui.info(
        'El insumo aún no está en el inventario. Actualiza la lista e intenta de nuevo.',
      );
      return;
    }
    this.abrirAjuste(materia, 'entrada');
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service
      .listarMaterias()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.materias.set(respuesta.items);
          const paginas = Math.max(1, Math.ceil(this.filtradas().length / this.porPagina));
          if (this.pagina() > paginas) this.pagina.set(paginas);
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar el inventario.'));
        },
      });
  }

  cargarMovimientos(): void {
    this.cargandoMovimientos.set(true);
    this.service
      .listarMovimientos({ page: 1, perPage: 8 })
      .pipe(finalize(() => this.cargandoMovimientos.set(false)))
      .subscribe({
        next: (respuesta) => this.movimientos.set(respuesta.items),
        error: () => this.movimientos.set([]),
      });
  }

  cargarProveedores(): void {
    this.service.listarProveedores().subscribe({
      next: (respuesta) => this.proveedores.set(respuesta.items),
      error: () => this.proveedores.set([]),
    });
  }

  filtrar(): void {
    this.pagina.set(1);
  }

  limpiar(): void {
    this.filtros.reset({ q: '', categoria: '', estado: '' });
    this.pagina.set(1);
  }

  irA(pagina: number): void {
    const destino = Math.min(Math.max(pagina, 1), this.paginas());
    this.pagina.set(destino);
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({
      nombre: '',
      categoria: 'otro',
      unidadMedida: 'pieza',
      stockActual: 0,
      stockMinimo: 0,
      stockMaximo: 0,
      costoUnitario: 0,
      proveedorId: '',
    });
    this.formularioAbierto.set(true);
  }

  abrirEditar(materia: MateriaPrimaApi): void {
    this.editando.set(materia);
    this.formulario.reset({
      nombre: materia.nombre,
      categoria: materia.categoria as CategoriaMateriaPrima,
      unidadMedida: materia.unidadMedida,
      stockActual: materia.stockActual,
      stockMinimo: materia.stockMinimo,
      stockMaximo: materia.stockMaximo,
      costoUnitario: materia.costoUnitario,
      proveedorId: materia.proveedorId ? String(materia.proveedorId) : '',
    });
    this.formularioAbierto.set(true);
  }

  cerrarFormulario(): void {
    this.formularioAbierto.set(false);
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
      categoria: valores.categoria,
      unidadMedida: valores.unidadMedida,
      stockActual: Number(valores.stockActual),
      stockMinimo: Number(valores.stockMinimo),
      stockMaximo: Number(valores.stockMaximo),
      costoUnitario: Number(valores.costoUnitario),
      proveedorId: valores.proveedorId ? Number(valores.proveedorId) : null,
    };
    const edicion = this.editando();
    this.guardando.set(true);
    const peticion = edicion
      ? this.service.actualizarMateria(edicion.id, body)
      : this.service.crearMateria(body);

    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: () => {
        this.ui.exito(edicion ? 'Insumo actualizado.' : 'Insumo registrado.');
        this.cerrarFormulario();
        this.cargar();
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos guardar el insumo.')),
    });
  }

  async desactivar(materia: MateriaPrimaApi): Promise<void> {
    const confirmado = await this.confirmacion.confirmar({
      titulo: 'Dar de baja insumo',
      mensaje: `¿Dar de baja ${materia.nombre}? Su historial de movimientos se conserva.`,
      confirmar: 'Dar de baja',
      peligro: true,
    });
    if (!confirmado) return;

    this.service.desactivarMateria(materia.id).subscribe({
      next: () => {
        this.ui.exito('Insumo dado de baja.');
        this.cargar();
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos dar de baja el insumo.')),
    });
  }

  abrirAjuste(materia?: MateriaPrimaApi, tipo: TipoMovimiento = 'entrada'): void {
    const objetivo = materia ?? this.filtradas()[0] ?? this.materias()[0];
    if (!objetivo) {
      this.ui.info('Registra primero un insumo para capturar movimientos.');
      return;
    }
    this.materiaAjuste.set(objetivo);
    this.ajusteForm.reset({
      materiaId: String(objetivo.id),
      tipo,
      cantidad: 0,
      referencia: '',
      motivo: '',
    });
    this.ajusteAbierto.set(true);
  }

  cerrarAjuste(): void {
    this.ajusteAbierto.set(false);
    this.materiaAjuste.set(null);
  }

  registrarMovimiento(): void {
    if (this.ajusteForm.invalid) {
      this.ajusteForm.markAllAsTouched();
      return;
    }
    const valores = this.ajusteForm.getRawValue();
    const materia = this.materias().find((m) => m.id === Number(valores.materiaId));
    if (!materia) {
      this.ui.error('Selecciona un insumo válido.');
      return;
    }
    this.ajustando.set(true);
    this.service
      .ajustarInventario(materia.id, {
        tipo: valores.tipo,
        cantidad: Number(valores.cantidad),
        referencia: valores.referencia.trim() || undefined,
        motivo: valores.motivo.trim() || undefined,
      })
      .pipe(finalize(() => this.ajustando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.materias.update((lista) =>
            lista.map((fila) => (fila.id === respuesta.materia.id ? respuesta.materia : fila)),
          );
          this.cerrarAjuste();
          this.cargarMovimientos();
          this.cargar();
          this.ui.exito(
            `Movimiento registrado. ${respuesta.materia.nombre}: ${this.cantidad(
              respuesta.materia.stockActual,
            )}.`,
          );
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos registrar el movimiento.')),
      });
  }

  exportar(): void {
    const filas = [
      [
        'Insumo',
        'Categoría',
        'Unidad',
        'Stock actual',
        'Stock mínimo',
        'Stock máximo',
        'Costo unitario',
        'Valor',
        'Proveedor',
        'Estado',
      ],
      ...this.filtradas().map((materia) => {
        const estado = this.estadoStock(materia);
        return [
          materia.nombre,
          this.etiquetaCategoria(materia.categoria),
          materia.unidadMedida,
          String(materia.stockActual),
          String(materia.stockMinimo),
          String(materia.stockMaximo),
          String(materia.costoUnitario),
          String(Math.round(materia.stockActual * materia.costoUnitario * 100) / 100),
          materia.proveedor ?? '',
          estado.etiqueta,
        ];
      }),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'inventario-llamma.csv';
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Inventario exportado en CSV.');
  }

  estadoStock(materia: MateriaPrimaApi): EstadoStock {
    const actual = Number(materia.stockActual) || 0;
    const minimo = Number(materia.stockMinimo) || 0;
    const maximo = Number(materia.stockMaximo) || 0;
    const base = maximo > 0 ? maximo : Math.max(minimo * 2, actual, 1);
    const porcentaje = Math.min(100, Math.max(2, Math.round((actual / base) * 100)));

    if (actual <= 0 || (minimo > 0 && actual <= minimo * 0.5)) {
      return {
        clave: 'critico',
        etiqueta: 'Crítico',
        badge: 'badge-soft-danger',
        barra: 'bg-danger',
        texto: 'text-danger',
        porcentaje,
      };
    }
    if (minimo > 0 && actual <= minimo) {
      return {
        clave: 'bajo',
        etiqueta: 'Bajo',
        badge: 'badge-soft-warning',
        barra: 'bg-warning',
        texto: 'text-warning',
        porcentaje,
      };
    }
    return {
      clave: 'optimo',
      etiqueta: 'Óptimo',
      badge: 'badge-soft-success',
      barra: 'bg-success',
      texto: 'text-success',
      porcentaje,
    };
  }

  iconoCategoria(categoria: string): string {
    return CATEGORIAS_MATERIA.find((fila) => fila.valor === categoria)?.icono ?? 'bi-box-seam';
  }

  tonoCategoria(categoria: string): string {
    return TONO_CATEGORIA[categoria] ?? 'icon-tile-ink';
  }

  etiquetaCategoria(categoria: string): string {
    return CATEGORIAS_MATERIA.find((fila) => fila.valor === categoria)?.etiqueta ?? categoria;
  }

  unidadCorta(unidad: string): string {
    return UNIDADES.find((fila) => fila.valor === unidad)?.corta ?? unidad;
  }

  etiquetaTipo(tipo: string): string {
    return TIPOS_MOVIMIENTO.find((fila) => fila.valor === tipo)?.etiqueta ?? tipo;
  }

  signoTipo(tipo: string): string {
    return TIPOS_MOVIMIENTO.find((fila) => fila.valor === tipo)?.signo ?? '';
  }

  claseMovimiento(tipo: string): { icono: string; tono: string; monto: string } {
    switch (tipo) {
      case 'entrada':
      case 'devolucion':
        return { icono: 'bi-box-arrow-in-down', tono: 'icon-tile-success', monto: 'text-success' };
      case 'salida':
      case 'merma':
        return { icono: 'bi-box-arrow-up', tono: 'icon-tile-danger', monto: 'text-danger' };
      default:
        return { icono: 'bi-sliders', tono: 'icon-tile-warning', monto: 'text-warning' };
    }
  }

  rangoTexto(): string {
    const total = this.filtradas().length;
    const inicio = total ? (this.pagina() - 1) * this.porPagina + 1 : 0;
    return `Mostrando ${inicio}–${Math.min(this.pagina() * this.porPagina, total)} de ${total} insumos`;
  }

  cantidad(valor: number, unidad?: string): string {
    const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(
      Number(valor ?? 0),
    );
    return unidad ? `${numero} ${this.unidadCorta(unidad)}` : numero;
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  costoUnitario(materia: MateriaPrimaApi): string {
    const numero = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(materia.costoUnitario ?? 0));
    return `${numero} / ${this.unidadCorta(materia.unidadMedida)}`;
  }

  fechaHora(valor: string | null | undefined): string {
    if (!valor) return 'Sin fecha';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  dosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }
}
