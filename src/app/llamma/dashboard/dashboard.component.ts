import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { ETAPAS_PRODUCCION, LINEAS_PRODUCCION, etiquetaDe } from '../estados';
import { LlammaService } from '../llamma.service';
import { ResumenDashboardApi } from '../llamma.models';
import { UiService } from '../ui.service';

const COLORES_LINEA: Record<string, string> = {
  'gran-formato': 'var(--llamma-cyan)',
  textil: 'var(--llamma-magenta)',
  promocionales: 'var(--llamma-yellow)',
  papeleria: 'var(--llamma-carbon)',
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);

  readonly resumen = signal<ResumenDashboardApi | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly lineas = computed(() => {
    const filas = this.resumen()?.ventasPorLinea ?? [];
    const maximo = Math.max(1, ...filas.map((fila) => fila.total));
    return filas.map((fila) => ({
      ...fila,
      etiqueta: etiquetaDe(LINEAS_PRODUCCION, fila.linea),
      color: COLORES_LINEA[fila.linea] ?? 'var(--llamma-carbon)',
      porcentaje: Math.max(6, Math.round((fila.total / maximo) * 100)),
    }));
  });

  readonly etapas = computed(() => {
    const filas = this.resumen()?.produccionPorEtapa ?? [];
    const total = this.totalProduccion();
    return [...filas]
      .sort((a, b) => b.total - a.total)
      .map((fila) => ({
        ...fila,
        etiqueta: etiquetaDe(ETAPAS_PRODUCCION, fila.etapa),
        porcentaje: total ? Math.round((fila.total / total) * 100) : 0,
      }));
  });

  readonly totalProduccion = computed(() => this.resumen()?.ordenesEnProduccion ?? 0);

  readonly donutFondo = computed(() => {
    const etapas = this.etapas();
    const total = this.totalProduccion();
    if (!etapas.length || !total) return 'conic-gradient(#efeee9 0 100%)';
    const colores = [
      'var(--llamma-cyan)',
      'var(--llamma-magenta)',
      'var(--llamma-yellow)',
      'var(--llamma-carbon)',
      '#9ba3a7',
    ];
    let acumulado = 0;
    const partes = etapas.map((etapa, indice) => {
      const inicio = acumulado;
      acumulado += (etapa.total / total) * 100;
      return `${colores[indice % colores.length]} ${inicio}% ${acumulado}%`;
    });
    return `conic-gradient(${partes.join(', ')})`;
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.resumenDashboard().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar el panel ejecutivo.'));
        this.cargando.set(false);
      },
    });
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
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
    if (!valor) return 'Sin fecha';
    const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  }

  claseEstado(estado: string): string {
    const mapa: Record<string, string> = {
      confirmado: 'badge-soft-warning',
      'en-produccion': 'badge-soft-cyan',
      listo: 'badge-soft-success',
      entregado: 'badge-soft-success',
      cancelado: 'badge-soft-danger',
      cotizacion: 'badge-soft-cyan',
    };
    return mapa[estado] ?? 'badge-soft-cyan';
  }

  etiquetaEstado(estado: string): string {
    return estado.replace(/-/g, ' ').replace(/^\w/, (letra) => letra.toUpperCase());
  }

  porcentajeStock(actual: number, maximo: number): number {
    if (!maximo) return 4;
    return Math.max(4, Math.min(100, Math.round((actual / maximo) * 100)));
  }
}
