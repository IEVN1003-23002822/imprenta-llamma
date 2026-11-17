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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';
import {
  ClienteApi,
  EtapaProduccion,
  PedidoApi,
  PagoApi,
  PrioridadPedido,
} from '../llamma.models';
import { LlammaService } from '../llamma.service';
import { UiService } from '../ui.service';

const ESTADOS: { valor: string; etiqueta: string }[] = [
  { valor: 'cotizacion', etiqueta: 'Cotización' },
  { valor: 'confirmado', etiqueta: 'Confirmado' },
  { valor: 'en-produccion', etiqueta: 'En producción' },
  { valor: 'listo', etiqueta: 'Listo' },
  { valor: 'entregado', etiqueta: 'Entregado' },
  { valor: 'cancelado', etiqueta: 'Cancelado' },
];

const PRIORIDADES: Record<PrioridadPedido, string> = {
  baja: 'Prioridad baja',
  media: 'Prioridad media',
  alta: 'Prioridad alta',
  urgente: 'Prioridad urgente',
};

const ETAPAS: Record<EtapaProduccion, { etiqueta: string; icono: string }> = {
  diseno: { etiqueta: 'Diseño y preprensa', icono: 'bi-vector-pen' },
  impresion: { etiqueta: 'Impresión', icono: 'bi-printer' },
  laminado: { etiqueta: 'Laminado', icono: 'bi-layers' },
  corte: { etiqueta: 'Corte', icono: 'bi-scissors' },
  confeccion: { etiqueta: 'Confección', icono: 'bi-bag' },
  armado: { etiqueta: 'Armado', icono: 'bi-tools' },
  acabado: { etiqueta: 'Acabado', icono: 'bi-stars' },
  entrega: { etiqueta: 'Entrega', icono: 'bi-box-seam' },
};

@Component({
  selector: 'app-detalle',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './detalle.component.html',
  styleUrl: './detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly pedidos = signal<PedidoApi[]>([]);
  readonly pedido = signal<PedidoApi | null>(null);
  readonly cliente = signal<ClienteApi | null>(null);
  readonly cargandoLista = signal(true);
  readonly cargandoDetalle = signal(false);
  readonly guardandoEstado = signal(false);
  readonly registrandoPago = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPago = signal(false);

  readonly estados = ESTADOS;
  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'ventas'));

  readonly pagoForm = this.fb.nonNullable.group({
    tipo: ['abono', [Validators.required]],
    metodo: ['transferencia', [Validators.required]],
    monto: [0, [Validators.required, Validators.min(1)]],
    referencia: [''],
  });

  readonly pagos = computed<PagoApi[]>(() => this.pedido()?.pagos ?? []);
  readonly pagado = computed(() =>
    this.pagos()
      .filter((pago) => pago.confirmado)
      .reduce((total, pago) => total + Number(pago.monto ?? 0), 0),
  );
  readonly partidas = computed(() => this.pedido()?.items ?? []);
  readonly totalPiezas = computed(() =>
    this.partidas().reduce((total, item) => total + Number(item.cantidad ?? 0), 0),
  );
  readonly etapas = computed(() => {
    const historial = this.pedido()?.ordenProduccion?.historialEtapas ?? [];
    return [...historial]
      .sort((a, b) => a.id - b.id)
      .map((registro) => ({
        ...registro,
        ...(ETAPAS[registro.etapa] ?? { etiqueta: registro.etapa, icono: 'bi-circle' }),
        clase:
          registro.estado === 'completada'
            ? 'is-done'
            : registro.estado === 'en-proceso'
              ? 'is-active'
              : 'is-pending',
      }));
  });
  readonly etapaActual = computed(() => {
    const lista = this.etapas();
    const indice = lista.findIndex((etapa) => etapa.clase === 'is-active');
    return indice >= 0 ? indice + 1 : lista.filter((etapa) => etapa.clase === 'is-done').length;
  });
  readonly controles = computed(() => this.pedido()?.ordenProduccion?.controlesCalidad ?? []);
  readonly archivos = computed(() =>
    this.partidas()
      .filter((item) => !!item.archivoDiseno)
      .map((item) => ({
        nombre: String(item.archivoDiseno).split(/[\\/]/).pop() ?? 'archivo',
        ruta: item.archivoDiseno,
        descripcion: item.descripcion,
      })),
  );

  ngOnInit(): void {
    this.cargarLista();
  }

  cargarLista(): void {
    this.cargandoLista.set(true);
    this.service
      .listarPedidos({ page: 1, perPage: 8 })
      .pipe(finalize(() => this.cargandoLista.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.pedidos.set(respuesta.items);
          const solicitado = Number(this.route.snapshot.queryParamMap.get('pedido'));
          const actual = this.pedido()?.id;
          const id =
            (Number.isFinite(solicitado) && solicitado > 0 && solicitado) ||
            actual ||
            respuesta.items[0]?.id;
          if (id) {
            this.seleccionar(Number(id));
          } else {
            this.error.set('Todavía no hay pedidos registrados.');
          }
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar las órdenes.'));
        },
      });
  }

  seleccionar(id: number): void {
    if (this.pedido()?.id === id && !this.error()) return;
    this.cargandoDetalle.set(true);
    this.error.set(null);
    this.mostrarPago.set(false);
    this.service
      .detallePedido(id)
      .pipe(finalize(() => this.cargandoDetalle.set(false)))
      .subscribe({
        next: (pedido) => {
          this.pedido.set(pedido);
          this.pagoForm.patchValue({ monto: Math.max(1, Math.round(pedido.saldo)) });
          this.cargarCliente(pedido.clienteId);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { pedido: pedido.id },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar el pedido.'));
        },
      });
  }

  private cargarCliente(clienteId: number): void {
    this.service.detalleCliente(clienteId).subscribe({
      next: (cliente) => this.cliente.set(cliente),
      error: () => this.cliente.set(null),
    });
  }

  cambiarEstado(evento: Event): void {
    const pedido = this.pedido();
    const estado = (evento.target as HTMLSelectElement).value;
    if (!pedido || estado === pedido.estado) return;

    this.guardandoEstado.set(true);
    this.service
      .cambiarEstadoPedido(pedido.id, estado)
      .pipe(finalize(() => this.guardandoEstado.set(false)))
      .subscribe({
        next: () => {
          this.pedido.update((actual) => (actual ? { ...actual, estado: estado as PedidoApi['estado'] } : actual));
          this.pedidos.update((lista) =>
            lista.map((fila) =>
              fila.id === pedido.id ? { ...fila, estado: estado as PedidoApi['estado'] } : fila,
            ),
          );
          this.ui.exito(`Pedido ${pedido.folio} actualizado a ${this.etiquetaEstado(estado)}.`);
        },
        error: (error) => {
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cambiar el estado.'));
        },
      });
  }

  abrirPago(): void {
    const saldo = this.pedido()?.saldo ?? 0;
    this.pagoForm.reset({
      tipo: saldo > 0 ? 'abono' : 'saldo',
      metodo: 'transferencia',
      monto: Math.max(1, Math.round(saldo)),
      referencia: '',
    });
    this.mostrarPago.set(true);
  }

  registrarPago(): void {
    const pedido = this.pedido();
    if (!pedido) return;
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }

    this.registrandoPago.set(true);
    this.service
      .registrarPago(pedido.id, this.pagoForm.getRawValue())
      .pipe(finalize(() => this.registrandoPago.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.pedido.set(respuesta.pedido);
          this.pedidos.update((lista) =>
            lista.map((fila) =>
              fila.id === pedido.id
                ? { ...fila, anticipo: respuesta.pedido.anticipo, saldo: respuesta.pedido.saldo }
                : fila,
            ),
          );
          this.mostrarPago.set(false);
          this.ui.exito(`Pago registrado. Saldo pendiente: ${this.moneda(respuesta.pedido.saldo)}.`);
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos registrar el pago.'));
        },
      });
  }

  imprimir(): void {
    window.print();
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(valor ?? 0));
  }

  private aFecha(valor: string | null | undefined): Date | null {
    if (!valor) return null;
    const fecha = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  fechaCorta(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    if (!fecha) return 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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

  etiquetaEstado(estado: string): string {
    return ESTADOS.find((fila) => fila.valor === estado)?.etiqueta ?? estado;
  }

  claseEstado(estado: string): string {
    const mapa: Record<string, string> = {
      cotizacion: 'badge-soft-cyan',
      confirmado: 'badge-soft-warning',
      'en-produccion': 'badge-soft-cyan',
      listo: 'badge-soft-success',
      entregado: 'badge-soft-success',
      cancelado: 'badge-soft-danger',
    };
    return mapa[estado] ?? 'badge-soft-cyan';
  }

  clasePrioridad(prioridad: string): string {
    const mapa: Record<string, string> = {
      baja: 'badge-soft-muted',
      media: 'badge-soft-cyan',
      alta: 'badge-soft-magenta',
      urgente: 'badge-soft-danger',
    };
    return mapa[prioridad] ?? 'badge-soft-cyan';
  }

  etiquetaPrioridad(prioridad: string): string {
    return PRIORIDADES[prioridad as PrioridadPedido] ?? `Prioridad ${prioridad}`;
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

  estadoPago(): { titulo: string; detalle: string; ok: boolean } {
    const pedido = this.pedido();
    if (!pedido) return { titulo: 'Sin información', detalle: 'Selecciona una orden', ok: false };
    if (pedido.saldo <= 0.01) {
      return { titulo: 'Pedido liquidado', detalle: `Pagado ${this.moneda(this.pagado())}`, ok: true };
    }
    if (this.pagado() > 0) {
      return {
        titulo: 'Anticipo confirmado',
        detalle: `Pagado ${this.moneda(this.pagado())} de ${this.moneda(pedido.total)}`,
        ok: true,
      };
    }
    return {
      titulo: 'Sin pagos registrados',
      detalle: `Saldo pendiente ${this.moneda(pedido.saldo)}`,
      ok: false,
    };
  }
}
