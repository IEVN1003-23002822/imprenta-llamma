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

import { AuthService } from '../../core/services/auth.service';
import {
  ESTADOS_PEDIDO,
  ETAPAS_PRODUCCION,
  PRIORIDADES,
  badgeDe,
  etiquetaDe,
  iconoDe,
} from '../../core/models/estados';
import { ClienteApi, PedidoApi, PagoApi } from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { UiService } from '../../core/services/ui.service';

/** Preferencia local de paneles desplegados; no contiene datos del pedido. */
const CLAVE_SECCIONES = 'llamma.detalle.secciones.v1';

type SeccionDetalle = 'produccion' | 'calidad' | 'pagos' | 'entrega' | 'archivos';

const SECCIONES_INICIALES: Record<SeccionDetalle, boolean> = {
  produccion: false,
  calidad: false,
  pagos: false,
  entrega: false,
  archivos: false,
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
  readonly secciones = signal(this.leerSecciones());

  readonly estados = ESTADOS_PEDIDO;
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
        etiqueta: etiquetaDe(ETAPAS_PRODUCCION, registro.etapa),
        icono: iconoDe(ETAPAS_PRODUCCION, registro.etapa),
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
  readonly etapaEnProceso = computed(
    () => this.etapas().find((etapa) => etapa.clase === 'is-active')?.etiqueta ?? null,
  );
  readonly controlesRechazados = computed(
    () => this.controles().filter((control) => !control.aprobado).length,
  );
  readonly textoEntrega = computed(() => {
    const fecha = this.aFecha(this.pedido()?.fechaEntrega ?? null);
    if (!fecha) return 'Fecha por confirmar';
    const hoy = new Date();
    const dias = Math.round(
      (new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime() -
        new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) /
        86_400_000,
    );
    if (dias === 0) return 'Hoy';
    if (dias > 0) return `En ${dias} ${dias === 1 ? 'día' : 'días'}`;
    const atraso = Math.abs(dias);
    return `Vencida hace ${atraso} ${atraso === 1 ? 'día' : 'días'}`;
  });

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
          this.pedido.update((actual) =>
            actual ? { ...actual, estado: estado as PedidoApi['estado'] } : actual,
          );
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
          this.ui.exito(
            `Pago registrado. Saldo pendiente: ${this.moneda(respuesta.pedido.saldo)}.`,
          );
        },
        error: (error: HttpErrorResponse) => {
          this.ui.error(this.ui.mensajeDeError(error, 'No pudimos registrar el pago.'));
        },
      });
  }

  imprimir(): void {
    const previas = this.secciones();
    if (Object.values(previas).every(Boolean)) {
      window.print();
      return;
    }
    this.secciones.set({
      produccion: true,
      calidad: true,
      pagos: true,
      entrega: true,
      archivos: true,
    });
    const restaurar = () => {
      this.secciones.set(previas);
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    // Se cede un turno de render para que el DOM impreso incluya los paneles.
    window.setTimeout(() => window.print(), 60);
  }

  estaAbierta(clave: SeccionDetalle): boolean {
    return this.secciones()[clave];
  }

  alternarSeccion(clave: SeccionDetalle): void {
    const abiertas = { ...this.secciones(), [clave]: !this.secciones()[clave] };
    this.secciones.set(abiertas);
    try {
      localStorage.setItem(CLAVE_SECCIONES, JSON.stringify(abiertas));
    } catch {
      // Sin almacenamiento disponible: el estado sigue viviendo en memoria.
    }
  }

  private leerSecciones(): Record<SeccionDetalle, boolean> {
    const valores = { ...SECCIONES_INICIALES };
    try {
      const crudo = localStorage.getItem(CLAVE_SECCIONES);
      if (!crudo) return valores;
      const guardado = JSON.parse(crudo) as Partial<Record<SeccionDetalle, boolean>>;
      for (const clave of Object.keys(valores) as SeccionDetalle[]) {
        const valor = guardado[clave];
        if (typeof valor === 'boolean') valores[clave] = valor;
      }
    } catch {
      // Preferencias ilegibles: se conservan los valores iniciales.
    }
    return valores;
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
    return etiquetaDe(ESTADOS_PEDIDO, estado);
  }

  claseEstado(estado: string): string {
    return badgeDe(ESTADOS_PEDIDO, estado, 'badge-soft-cyan');
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
    return (
      PRIORIDADES.find((fila) => fila.valor === prioridad)?.etiqueta ?? `Prioridad ${prioridad}`
    );
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
      return {
        titulo: 'Pedido liquidado',
        detalle: `Pagado ${this.moneda(this.pagado())}`,
        ok: true,
      };
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
