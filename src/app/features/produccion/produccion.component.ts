import { DatePipe } from '@angular/common';
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
import {
  ESTADOS_PRODUCCION,
  ETAPAS_PRODUCCION,
  badgeDe,
  etiquetaDe,
} from '../../core/models/estados';
import {
  ControlCalidadApi,
  EtapaProduccion,
  EstadoProduccion,
  OrdenProduccionApi,
  PedidoApi,
  TableroProduccion,
} from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { ModalAccesibleDirective } from '../../shared/modal-accesible.directive';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-produccion',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, ModalAccesibleDirective],
  templateUrl: './produccion.component.html',
  styleUrl: './produccion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProduccionComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly etapas = ETAPAS_PRODUCCION;
  readonly estados = ESTADOS_PRODUCCION;

  readonly tablero = signal<TableroProduccion | null>(null);
  readonly pedidos = signal<PedidoApi[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly seleccionada = signal<OrdenProduccionApi | null>(null);
  readonly guardando = signal(false);
  readonly registrandoCalidad = signal(false);
  readonly moviendoId = signal<number | null>(null);

  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'produccion'));

  readonly ordenForm = this.fb.nonNullable.group({
    etapa: ['diseno' as EtapaProduccion, [Validators.required]],
    estado: ['pendiente' as EstadoProduccion, [Validators.required]],
    observaciones: [''],
  });

  readonly calidadForm = this.fb.nonNullable.group({
    criterio: ['', [Validators.required, Validators.minLength(3)]],
    aprobado: [true],
    observaciones: [''],
  });

  readonly pedidosPorId = computed(() => {
    const mapa = new Map<number, PedidoApi>();
    for (const pedido of this.pedidos()) mapa.set(pedido.id, pedido);
    return mapa;
  });

  readonly columnas = computed(() => {
    const tablero = this.tablero();
    const porEtapa = new Map<EtapaProduccion, OrdenProduccionApi[]>();
    for (const columna of tablero?.columnas ?? []) porEtapa.set(columna.etapa, columna.ordenes);
    return ETAPAS_PRODUCCION.map((etapa) => ({
      ...etapa,
      ordenes: porEtapa.get(etapa.valor) ?? [],
    }));
  });

  readonly ordenes = computed(() =>
    (this.tablero()?.columnas ?? []).flatMap((columna) => columna.ordenes),
  );

  readonly estadisticas = computed(() => {
    const columnas = this.columnas();
    const total = this.tablero()?.total ?? 0;
    const enImpresion =
      columnas.find((columna) => columna.valor === 'impresion')?.ordenes.length ?? 0;
    const enEntrega = columnas.find((columna) => columna.valor === 'entrega')?.ordenes.length ?? 0;
    const atencion = this.ordenes().filter(
      (orden) => orden.estado === 'pausada' || orden.estado === 'rechazada',
    ).length;
    return [
      {
        icono: 'bi-gear-wide-connected',
        tono: 'icon-tile-cyan',
        valor: this.dosDigitos(total),
        etiqueta: 'Órdenes activas',
      },
      {
        icono: 'bi-printer',
        tono: 'icon-tile-magenta',
        valor: this.dosDigitos(enImpresion),
        etiqueta: 'En etapa de impresión',
      },
      {
        icono: 'bi-exclamation-triangle',
        tono: atencion ? 'icon-tile-warning' : 'icon-tile-success',
        valor: this.dosDigitos(atencion),
        etiqueta: 'Órdenes que requieren atención',
      },
      {
        icono: 'bi-box-seam',
        tono: 'icon-tile-success',
        valor: this.dosDigitos(enEntrega),
        etiqueta: 'Listas para entrega',
      },
    ];
  });

  readonly resumenEtapas = computed(() => {
    const columnas = this.columnas();
    const maximo = Math.max(1, ...columnas.map((columna) => columna.ordenes.length));
    return columnas.map((columna) => {
      const total = columna.ordenes.length;
      return {
        ...columna,
        total,
        porcentaje: total === 0 ? 0 : Math.max(6, Math.round((total / maximo) * 100)),
      };
    });
  });

  readonly calidadReciente = computed(() => {
    const filas = this.ordenes().flatMap((orden) =>
      (orden.controlesCalidad ?? []).map((control) => ({
        control,
        folio: orden.pedidoFolio ?? `Orden ${orden.id}`,
        ordenId: orden.id,
      })),
    );
    return filas
      .sort((a, b) => String(b.control.fecha).localeCompare(String(a.control.fecha)))
      .slice(0, 6);
  });

  readonly controlesPendientes = computed(
    () => this.calidadReciente().filter((fila) => !fila.control.aprobado).length,
  );

  readonly hoy = new Date();

  ngOnInit(): void {
    this.cargar();
    this.cargarPedidos();
  }

  cargar(seleccionarId?: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service
      .tableroProduccion()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (tablero) => {
          this.tablero.set(tablero);
          this.cargarDetalles(
            tablero.columnas.flatMap((columna) => columna.ordenes.map((orden) => orden.pedidoId)),
          );
          const objetivo = seleccionarId ?? this.seleccionada()?.id;
          if (objetivo) {
            const actual = tablero.columnas
              .flatMap((columna) => columna.ordenes)
              .find((orden) => orden.id === objetivo);
            this.seleccionada.set(actual ?? null);
            if (actual) this.sincronizarFormulario(actual);
          }
        },
        error: (error) => {
          this.error.set(
            this.ui.mensajeDeError(error, 'No pudimos cargar el tablero de producción.'),
          );
        },
      });
  }

  private cargarPedidos(): void {
    this.service.listarPedidos({ page: 1, perPage: 100 }).subscribe({
      next: (respuesta) =>
        this.pedidos.update((actuales) =>
          respuesta.items.map((pedido) => {
            const previo = actuales.find((fila) => fila.id === pedido.id);
            return previo?.items?.length
              ? { ...pedido, items: previo.items, pagos: previo.pagos ?? pedido.pagos }
              : pedido;
          }),
        ),
      error: () => this.pedidos.set([]),
    });
  }

  private cargarDetalles(ids: number[]): void {
    const unicos = [...new Set(ids)];
    for (const id of unicos) {
      const conocido = this.pedidos().find((pedido) => pedido.id === id);
      if (conocido?.items?.length) continue;
      this.service.detallePedido(id).subscribe({
        next: (pedido) => {
          this.pedidos.update((lista) => [
            ...lista.filter((fila) => fila.id !== pedido.id),
            pedido,
          ]);
        },
        error: () => undefined,
      });
    }
  }

  pedidoDe(orden: OrdenProduccionApi): PedidoApi | undefined {
    return this.pedidosPorId().get(orden.pedidoId);
  }

  titulo(orden: OrdenProduccionApi): string {
    const pedido = this.pedidoDe(orden);
    const primero = pedido?.items?.[0];
    if (primero) {
      const extra = (pedido?.items?.length ?? 0) - 1;
      return extra > 0 ? `${primero.descripcion} +${extra} más` : primero.descripcion;
    }
    return `Orden ${orden.pedidoFolio ?? orden.id}`;
  }

  cliente(orden: OrdenProduccionApi): string {
    return this.pedidoDe(orden)?.cliente ?? 'Cliente sin asignar';
  }

  fechaEntrega(orden: OrdenProduccionApi): string {
    return this.fechaCorta(this.pedidoDe(orden)?.fechaEntrega);
  }

  prioridad(orden: OrdenProduccionApi): string {
    return this.pedidoDe(orden)?.prioridad ?? 'media';
  }

  clasePrioridad(orden: OrdenProduccionApi): string {
    const mapa: Record<string, string> = {
      baja: 'badge-soft-muted',
      media: 'badge-soft-cyan',
      alta: 'badge-soft-magenta',
      urgente: 'badge-soft-danger',
    };
    return mapa[this.prioridad(orden)] ?? 'badge-soft-muted';
  }

  progreso(orden: OrdenProduccionApi): number {
    const indice = ETAPAS_PRODUCCION.findIndex((etapa) => etapa.valor === orden.etapa);
    return Math.round(((indice + 1) / ETAPAS_PRODUCCION.length) * 100);
  }

  indiceEtapa(etapa: string): number {
    return ETAPAS_PRODUCCION.findIndex((fila) => fila.valor === etapa);
  }

  etiquetaEtapa(etapa: string): string {
    return ETAPAS_PRODUCCION.find((fila) => fila.valor === etapa)?.etiqueta ?? etapa;
  }

  iconoEtapa(etapa: string): string {
    return ETAPAS_PRODUCCION.find((fila) => fila.valor === etapa)?.icono ?? 'bi-circle';
  }

  dotEtapa(etapa: string): string {
    return `kanban-dot ${ETAPAS_PRODUCCION.find((fila) => fila.valor === etapa)?.dot ?? 'dot-ink'}`;
  }

  etiquetaEstado(estado: string): string {
    return etiquetaDe(ESTADOS_PRODUCCION, estado);
  }

  claseEstado(estado: string): string {
    return badgeDe(ESTADOS_PRODUCCION, estado);
  }

  puedeAvanzar(orden: OrdenProduccionApi): boolean {
    return this.indiceEtapa(orden.etapa) < ETAPAS_PRODUCCION.length - 1;
  }

  puedeRetroceder(orden: OrdenProduccionApi): boolean {
    return this.indiceEtapa(orden.etapa) > 0;
  }

  mover(orden: OrdenProduccionApi, delta: number): void {
    const indice = this.indiceEtapa(orden.etapa);
    const destino = ETAPAS_PRODUCCION[indice + delta];
    if (!destino) return;
    this.moviendoId.set(orden.id);
    this.service
      .actualizarOrdenProduccion(orden.id, {
        etapa: destino.valor,
        estado: orden.estado === 'pendiente' ? 'en-proceso' : orden.estado,
      })
      .pipe(finalize(() => this.moviendoId.set(null)))
      .subscribe({
        next: (actualizada) => {
          this.ui.exito(`${actualizada.pedidoFolio}: ${this.etiquetaEtapa(actualizada.etapa)}.`);
          this.cargar();
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos mover la orden de etapa.')),
      });
  }

  abrirDetalle(orden: OrdenProduccionApi): void {
    this.seleccionada.set(orden);
    this.sincronizarFormulario(orden);
    this.calidadForm.reset({ criterio: '', aprobado: true, observaciones: '' });
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
  }

  private sincronizarFormulario(orden: OrdenProduccionApi): void {
    this.ordenForm.reset({
      etapa: orden.etapa,
      estado: orden.estado,
      observaciones: orden.observaciones ?? '',
    });
  }

  guardarCambios(): void {
    const orden = this.seleccionada();
    if (!orden || this.ordenForm.invalid) {
      this.ordenForm.markAllAsTouched();
      return;
    }
    const valores = this.ordenForm.getRawValue();
    this.guardando.set(true);
    this.service
      .actualizarOrdenProduccion(orden.id, {
        etapa: valores.etapa,
        estado: valores.estado,
        observaciones: valores.observaciones.trim() || undefined,
      })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.ui.exito('Orden de producción actualizada.');
          this.cargar(orden.id);
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos actualizar la orden.')),
      });
  }

  async completar(orden: OrdenProduccionApi): Promise<void> {
    const confirmado = await this.confirmacion.confirmar({
      titulo: 'Completar producción',
      mensaje: `¿Marcar ${orden.pedidoFolio ?? 'la orden'} como completada? El pedido se moverá a Listo.`,
      confirmar: 'Completar orden',
    });
    if (!confirmado) return;

    this.guardando.set(true);
    this.service
      .actualizarOrdenProduccion(orden.id, { estado: 'completada' })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.ui.exito('Orden completada. El pedido está listo para entrega.');
          this.cargar(orden.id);
        },
        error: (error) =>
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos completar la orden.')),
      });
  }

  registrarCalidad(): void {
    const orden = this.seleccionada();
    if (!orden) return;
    if (this.calidadForm.invalid) {
      this.calidadForm.markAllAsTouched();
      return;
    }
    const valores = this.calidadForm.getRawValue();
    this.registrandoCalidad.set(true);
    this.service
      .registrarCalidad(orden.id, {
        criterio: valores.criterio.trim(),
        aprobado: valores.aprobado,
        observaciones: valores.observaciones.trim() || undefined,
      })
      .pipe(finalize(() => this.registrandoCalidad.set(false)))
      .subscribe({
        next: (control) => {
          this.ui.exito(
            control.aprobado
              ? 'Control de calidad aprobado.'
              : 'Control de calidad registrado como rechazado.',
          );
          this.calidadForm.reset({ criterio: '', aprobado: true, observaciones: '' });
          this.cargar(orden.id);
        },
        error: (error) =>
          this.ui.error(
            this.ui.mensajeDeError(error, 'No pudimos registrar el control de calidad.'),
          ),
      });
  }

  exportar(): void {
    const filas = [
      ['Pedido', 'Cliente', 'Etapa', 'Estado', 'Responsable', 'Entrega', 'Observaciones'],
      ...this.ordenes().map((orden) => [
        orden.pedidoFolio ?? String(orden.pedidoId),
        this.cliente(orden),
        this.etiquetaEtapa(orden.etapa),
        this.etiquetaEstado(orden.estado),
        orden.responsable ?? '',
        this.fechaEntrega(orden),
        orden.observaciones ?? '',
      ]),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'produccion-llamma.csv';
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Reporte de turno exportado en CSV.');
  }

  iniciales(nombre: string | null | undefined): string {
    return (nombre || 'LL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase();
  }

  fechaCorta(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    if (!fecha) return 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  fechaHora(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    if (!fecha) return 'Pendiente';
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  controlesDe(orden: OrdenProduccionApi): ControlCalidadApi[] {
    return orden.controlesCalidad ?? [];
  }

  private aFecha(valor: string | null | undefined): Date | null {
    if (!valor) return null;
    const fecha = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private dosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }
}
