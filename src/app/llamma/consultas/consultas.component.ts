import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ClienteApi, ConsultaPedidosApi, LineaProduccion } from '../llamma.models';
import { LlammaService } from '../llamma.service';
import { UiService } from '../ui.service';

const LINEAS: { valor: LineaProduccion | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas las líneas' },
  { valor: 'gran-formato', etiqueta: 'Gran formato' },
  { valor: 'textil', etiqueta: 'Textil' },
  { valor: 'promocionales', etiqueta: 'Promocionales' },
  { valor: 'papeleria', etiqueta: 'Papelería' },
];

const ESTADOS = [
  { valor: '', etiqueta: 'Todo estado' },
  { valor: 'confirmado', etiqueta: 'Confirmado' },
  { valor: 'en-produccion', etiqueta: 'En producción' },
  { valor: 'listo', etiqueta: 'Listo' },
  { valor: 'entregado', etiqueta: 'Entregado' },
  { valor: 'cancelado', etiqueta: 'Cancelado' },
];

const COLORES_LINEA: Record<string, string> = {
  'gran-formato': 'fill-cyan',
  textil: 'fill-magenta',
  promocionales: 'fill-yellow',
  papeleria: 'fill-ink',
};

const ETIQUETAS_LINEA: Record<string, string> = {
  'gran-formato': 'Gran formato',
  textil: 'Textil',
  promocionales: 'Promocionales',
  papeleria: 'Papelería',
};

@Component({
  selector: 'app-consultas',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './consultas.component.html',
  styleUrl: './consultas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultasComponent implements OnInit {
  private readonly service = inject(LlammaService);
  readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);

  readonly lineas = LINEAS;
  readonly estados = ESTADOS;
  readonly clientes = signal<ClienteApi[]>([]);
  readonly resultado = signal<ConsultaPedidosApi | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly rangoActivo = signal('mes');
  readonly pagina = signal(1);

  readonly form = this.fb.nonNullable.group({
    desde: [this.primerDiaMes()],
    hasta: [this.hoy()],
    clienteId: [''],
    linea: [''],
    estado: [''],
    q: [''],
  });

  readonly estadisticas = computed(() => {
    const resumen = this.resultado()?.resumen;
    return [
      {
        icono: 'bi-receipt-cutoff',
        tono: 'icon-tile-cyan',
        valor: String(resumen?.pedidos ?? 0),
        etiqueta: 'Pedidos encontrados',
      },
      {
        icono: 'bi-cash-stack',
        tono: 'icon-tile-magenta',
        valor: this.moneda(resumen?.monto ?? 0),
        etiqueta: 'Monto consultado',
      },
      {
        icono: 'bi-bar-chart',
        tono: 'icon-tile-yellow',
        valor: this.moneda(resumen?.ticket ?? 0),
        etiqueta: 'Ticket promedio',
      },
      {
        icono: 'bi-check2-circle',
        tono: 'icon-tile-success',
        valor: String(resumen?.entregados ?? 0),
        etiqueta: 'Pedidos entregados',
      },
    ];
  });

  readonly distribucion = computed(() => {
    const filas = this.resultado()?.ventasPorLinea ?? [];
    const maximo = Math.max(1, ...filas.map((fila) => fila.total));
    return filas.map((fila) => ({
      ...fila,
      etiqueta: ETIQUETAS_LINEA[fila.linea] ?? fila.linea,
      clase: COLORES_LINEA[fila.linea] ?? 'fill-ink',
      porcentaje: Math.max(6, Math.round((fila.total / maximo) * 100)),
    }));
  });

  readonly paginas = computed(() => {
    const total = this.resultado()?.paginas ?? 0;
    const actual = this.resultado()?.pagina ?? 1;
    const desde = Math.max(1, actual - 2);
    const hasta = Math.min(total, desde + 4);
    return Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);
  });

  ngOnInit(): void {
    this.cargarClientes();
    this.cargar(1);
  }

  private cargarClientes(): void {
    this.service.listarClientes({ page: 1, perPage: 100 }).subscribe({
      next: (respuesta) => this.clientes.set(respuesta.items),
      error: () => this.clientes.set([]),
    });
  }

  cargar(page = 1): void {
    this.cargando.set(true);
    this.error.set(null);
    const valores = this.form.getRawValue();
    this.service
      .consultarPedidos({
        q: valores.q.trim() || undefined,
        estado: valores.estado || undefined,
        linea: valores.linea || undefined,
        clienteId: valores.clienteId ? Number(valores.clienteId) : undefined,
        desde: valores.desde || undefined,
        hasta: valores.hasta || undefined,
        page,
        perPage: 10,
      })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.resultado.set(respuesta);
          this.pagina.set(respuesta.pagina);
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos ejecutar la consulta.'));
        },
      });
  }

  limpiar(): void {
    this.form.reset({
      desde: this.primerDiaMes(),
      hasta: this.hoy(),
      clienteId: '',
      linea: '',
      estado: '',
      q: '',
    });
    this.rangoActivo.set('mes');
    this.cargar(1);
  }

  rango(clave: string): void {
    const hoy = new Date();
    const hasta = this.hoy();
    let desde = this.primerDiaMes();

    if (clave === '7d') {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - 7);
      desde = this.iso(fecha);
    } else if (clave === '30d') {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - 30);
      desde = this.iso(fecha);
    } else if (clave === 'trimestre') {
      const mes = Math.floor(hoy.getMonth() / 3) * 3;
      desde = this.iso(new Date(hoy.getFullYear(), mes, 1));
    } else if (clave === 'anio') {
      desde = this.iso(new Date(hoy.getFullYear(), 0, 1));
    }

    this.rangoActivo.set(clave);
    this.form.patchValue({ desde, hasta });
    this.cargar(1);
  }

  exportar(): void {
    const resultado = this.resultado();
    if (!resultado?.items.length) {
      this.ui.info('No hay resultados para exportar.');
      return;
    }

    const filas = [
      ['Folio', 'Fecha', 'Cliente', 'Líneas', 'Estado', 'Total'],
      ...resultado.items.map((pedido) => [
        pedido.folio,
        pedido.fechaPedido,
        pedido.cliente ?? '',
        pedido.lineas.map((linea) => ETIQUETAS_LINEA[linea] ?? linea).join(' / '),
        this.etiquetaEstado(pedido.estado),
        String(pedido.total),
      ]),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `consultas-llamma-${this.hoy()}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Resultados exportados en CSV.');
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

  etiquetaEstado(estado: string): string {
    return estado.replace(/-/g, ' ').replace(/^\w/, (letra) => letra.toUpperCase());
  }

  claseLinea(linea: string): string {
    const mapa: Record<string, string> = {
      'gran-formato': 'badge-soft-cyan',
      textil: 'badge-soft-magenta',
      promocionales: 'badge-soft-yellow',
      papeleria: 'badge-soft-muted',
    };
    return mapa[linea] ?? 'badge-soft-muted';
  }

  etiquetaLinea(linea: string): string {
    return ETIQUETAS_LINEA[linea] ?? linea;
  }

  iniciales(nombre: string): string {
    return nombre
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

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  rangoTexto(data: ConsultaPedidosApi): string {
    const inicio = data.total ? (data.pagina - 1) * data.porPagina + 1 : 0;
    const fin = Math.min(data.pagina * data.porPagina, data.total);
    return `Mostrando ${inicio}–${fin} de ${data.total} resultados`;
  }

  fechaCorta(valor: string | null | undefined): string {    if (!valor) return 'Sin fecha';
    const fecha = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private hoy(): string {
    return this.iso(new Date());
  }

  private primerDiaMes(): string {
    const hoy = new Date();
    return this.iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  private iso(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}

