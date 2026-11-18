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
import { CANALES_MARKETING, ESTADOS_ACTIVIDAD, badgeDe, etiquetaDe } from '../estados';
import { ActividadMarketingApi, CanalMarketing, EstadoActividadMarketing } from '../llamma.models';
import { LlammaService } from '../llamma.service';
import { ModalAccesibleDirective } from '../modal-accesible.directive';
import { UiService } from '../ui.service';

const TONO_CANAL: Record<string, string> = {
  'redes-sociales': 'icon-tile-cyan',
  'google-ads': 'icon-tile-yellow',
  correo: 'icon-tile-ink',
  'punto-de-venta': 'icon-tile-magenta',
  referidos: 'icon-tile-cyan',
  otro: 'icon-tile-ink',
};

const FILL_CANAL: Record<string, string> = {
  'redes-sociales': 'fill-cyan',
  'google-ads': 'fill-yellow',
  correo: 'fill-ink',
  'punto-de-venta': 'fill-magenta',
  referidos: 'fill-cyan',
  otro: 'fill-muted',
};

@Component({
  selector: 'app-marketing',
  imports: [ReactiveFormsModule, RouterLink, ModalAccesibleDirective],
  templateUrl: './marketing.component.html',
  styleUrl: './marketing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly canales = CANALES_MARKETING;
  readonly estados = ESTADOS_ACTIVIDAD;

  readonly actividades = signal<ActividadMarketingApi[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly pagina = signal(1);
  readonly porPagina = 6;

  readonly formularioAbierto = signal(false);
  readonly editando = signal<ActividadMarketingApi | null>(null);
  readonly guardando = signal(false);

  readonly puedeGestionar = computed(() => this.auth.tieneRol('admin', 'marketing'));

  readonly filtros = this.fb.nonNullable.group({ q: [''], canal: [''], estado: [''] });

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    canal: ['redes-sociales' as CanalMarketing, [Validators.required]],
    estado: ['planeada' as EstadoActividadMarketing, [Validators.required]],
    fechaInicio: [this.hoyISO(), [Validators.required]],
    fechaFin: [''],
    presupuesto: [0, [Validators.required, Validators.min(0)]],
    inversionReal: [0, [Validators.required, Validators.min(0)]],
    ingresosAtribuidos: [0, [Validators.required, Validators.min(0)]],
    descripcion: [''],
  });

  readonly filtradas = computed(() => {
    const { q, canal, estado } = this.filtros.getRawValue();
    const termino = q.trim().toLowerCase();
    return this.actividades().filter((actividad) => {
      if (canal && actividad.canal !== canal) return false;
      if (estado && actividad.estado !== estado) return false;
      if (!termino) return true;
      return [actividad.nombre, actividad.descripcion ?? '', this.etiquetaCanal(actividad.canal)]
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
    const actividades = this.actividades();
    const activas = actividades.filter((actividad) => actividad.estado === 'activa');
    const inversion = actividades.reduce((total, a) => total + Number(a.inversionReal ?? 0), 0);
    const ingresos = actividades.reduce((total, a) => total + Number(a.ingresosAtribuidos ?? 0), 0);
    const roi = inversion > 0 ? ingresos / inversion : 0;
    return [
      {
        icono: 'bi-wallet2',
        tono: 'icon-tile-cyan',
        valor: this.moneda(inversion),
        etiqueta: 'Inversión ejercida',
      },
      {
        icono: 'bi-graph-up-arrow',
        tono: 'icon-tile-magenta',
        valor: this.moneda(ingresos),
        etiqueta: 'Ingresos atribuidos',
      },
      {
        icono: 'bi-stars',
        tono: 'icon-tile-yellow',
        valor: `${roi.toFixed(1)}x`,
        etiqueta: 'Retorno de inversión',
      },
      {
        icono: 'bi-megaphone',
        tono: 'icon-tile-success',
        valor: this.dosDigitos(activas.length),
        etiqueta: 'Campañas activas',
      },
    ];
  });

  readonly canalesResumen = computed(() => {
    const mapa = new Map<string, { ingresos: number; inversion: number; campanas: number }>();
    for (const actividad of this.actividades()) {
      const fila = mapa.get(actividad.canal) ?? { ingresos: 0, inversion: 0, campanas: 0 };
      fila.ingresos += Number(actividad.ingresosAtribuidos ?? 0);
      fila.inversion += Number(actividad.inversionReal ?? 0);
      fila.campanas += 1;
      mapa.set(actividad.canal, fila);
    }
    const filas = [...mapa.entries()]
      .map(([canal, datos]) => ({ canal, ...datos }))
      .sort((a, b) => b.ingresos - a.ingresos);
    const maximo = Math.max(1, ...filas.map((fila) => fila.ingresos));
    return filas.slice(0, 6).map((fila) => ({
      ...fila,
      porcentaje: Math.max(4, Math.round((fila.ingresos / maximo) * 100)),
      etiqueta: this.etiquetaCanal(fila.canal),
      dot: `channel-dot ${this.dotCanal(fila.canal)}`,
      fill: FILL_CANAL[fila.canal] ?? 'fill-muted',
    }));
  });

  readonly presupuesto = computed(() => {
    const actividades = this.actividades().filter((actividad) => actividad.estado !== 'cancelada');
    const plan = actividades.reduce((total, a) => total + Number(a.presupuesto ?? 0), 0);
    const ejercido = actividades.reduce((total, a) => total + Number(a.inversionReal ?? 0), 0);
    const disponible = Math.max(plan - ejercido, 0);
    const porcentaje = plan > 0 ? Math.min(100, Math.round((ejercido / plan) * 100)) : 0;
    return {
      plan,
      ejercido,
      disponible,
      porcentaje,
      desviacion: ejercido > plan ? ejercido - plan : 0,
    };
  });

  readonly calendario = computed(() =>
    this.actividades()
      .filter((actividad) => actividad.estado === 'activa' || actividad.estado === 'planeada')
      .sort((a, b) => String(a.fechaInicio).localeCompare(String(b.fechaInicio)))
      .slice(0, 5),
  );

  readonly distribucionPresupuesto = computed(() => {
    const mapa = new Map<string, number>();
    for (const actividad of this.actividades()) {
      if (actividad.estado === 'cancelada') continue;
      mapa.set(
        actividad.canal,
        (mapa.get(actividad.canal) ?? 0) + Number(actividad.inversionReal ?? 0),
      );
    }
    const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const total = filas.reduce((suma, fila) => suma + fila[1], 0) || 1;
    return filas.map(([canal, monto], indice) => ({
      canal,
      etiqueta: this.etiquetaCanal(canal),
      monto,
      porcentaje: Math.round((monto / total) * 100),
      color: [
        'var(--llamma-cyan)',
        'var(--llamma-magenta)',
        'var(--llamma-yellow)',
        'var(--llamma-carbon)',
      ][indice % 4],
    }));
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service
      .listarActividades()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.actividades.set(respuesta.items);
          const paginas = Math.max(1, Math.ceil(this.filtradas().length / this.porPagina));
          if (this.pagina() > paginas) this.pagina.set(paginas);
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar las campañas.'));
        },
      });
  }

  filtrar(): void {
    this.pagina.set(1);
  }

  limpiar(): void {
    this.filtros.reset({ q: '', canal: '', estado: '' });
    this.pagina.set(1);
  }

  irA(pagina: number): void {
    this.pagina.set(Math.min(Math.max(pagina, 1), this.paginas()));
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.formulario.reset({
      nombre: '',
      canal: 'redes-sociales',
      estado: 'planeada',
      fechaInicio: this.hoyISO(),
      fechaFin: '',
      presupuesto: 0,
      inversionReal: 0,
      ingresosAtribuidos: 0,
      descripcion: '',
    });
    this.formularioAbierto.set(true);
  }

  abrirEditar(actividad: ActividadMarketingApi): void {
    this.editando.set(actividad);
    this.formulario.reset({
      nombre: actividad.nombre,
      canal: actividad.canal,
      estado: actividad.estado,
      fechaInicio: actividad.fechaInicio ?? this.hoyISO(),
      fechaFin: actividad.fechaFin ?? '',
      presupuesto: Number(actividad.presupuesto ?? 0),
      inversionReal: Number(actividad.inversionReal ?? 0),
      ingresosAtribuidos: Number(actividad.ingresosAtribuidos ?? 0),
      descripcion: actividad.descripcion ?? '',
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
      canal: valores.canal,
      estado: valores.estado,
      fechaInicio: valores.fechaInicio,
      fechaFin: valores.fechaFin || null,
      presupuesto: Number(valores.presupuesto),
      inversionReal: Number(valores.inversionReal),
      ingresosAtribuidos: Number(valores.ingresosAtribuidos),
      descripcion: valores.descripcion.trim() || null,
    };
    const edicion = this.editando();
    this.guardando.set(true);
    const peticion = edicion
      ? this.service.actualizarActividad(edicion.id, body)
      : this.service.crearActividad(body);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: () => {
        this.ui.exito(edicion ? 'Campaña actualizada.' : 'Campaña registrada.');
        this.cerrarFormulario();
        this.cargar();
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos guardar la campaña.')),
    });
  }

  cambiarEstado(evento: Event, actividad: ActividadMarketingApi): void {
    const estado = (evento.target as HTMLSelectElement).value as EstadoActividadMarketing;
    if (estado === actividad.estado) return;
    this.service.actualizarActividad(actividad.id, { estado }).subscribe({
      next: (actualizada) => {
        this.actividades.update((lista) =>
          lista.map((fila) => (fila.id === actualizada.id ? actualizada : fila)),
        );
        this.ui.exito(`Campaña ${actualizada.nombre}: ${this.etiquetaEstado(actualizada.estado)}.`);
      },
      error: (error) => {
        (evento.target as HTMLSelectElement).value = actividad.estado;
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos cambiar el estado.'));
      },
    });
  }

  exportar(): void {
    const filas = [
      [
        'Campaña',
        'Canal',
        'Estado',
        'Inicio',
        'Fin',
        'Presupuesto',
        'Inversión',
        'Ingresos atribuidos',
        'ROI',
      ],
      ...this.filtradas().map((actividad) => [
        actividad.nombre,
        this.etiquetaCanal(actividad.canal),
        this.etiquetaEstado(actividad.estado),
        actividad.fechaInicio ?? '',
        actividad.fechaFin ?? '',
        String(actividad.presupuesto),
        String(actividad.inversionReal),
        String(actividad.ingresosAtribuidos),
        `${Number(actividad.roi ?? 0).toFixed(2)}x`,
      ]),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'campanas-llamma.csv';
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Campañas exportadas en CSV.');
  }

  etiquetaCanal(canal: string): string {
    return etiquetaDe(CANALES_MARKETING, canal);
  }

  iconoCanal(canal: string): string {
    return CANALES_MARKETING.find((fila) => fila.valor === canal)?.icono ?? 'bi-three-dots';
  }

  dotCanal(canal: string): string {
    return CANALES_MARKETING.find((fila) => fila.valor === canal)?.dot ?? 'dot-ink';
  }

  tonoCanal(canal: string): string {
    return TONO_CANAL[canal] ?? 'icon-tile-ink';
  }

  etiquetaEstado(estado: string): string {
    return etiquetaDe(ESTADOS_ACTIVIDAD, estado);
  }

  claseEstado(estado: string): string {
    return badgeDe(ESTADOS_ACTIVIDAD, estado);
  }

  claseRoi(roi: number): string {
    const valor = Number(roi ?? 0);
    if (valor >= 4) return 'badge-soft-success';
    if (valor >= 2) return 'badge-soft-cyan';
    if (valor > 0) return 'badge-soft-warning';
    return 'badge-soft-muted';
  }

  periodo(actividad: ActividadMarketingApi): string {
    const inicio = this.fechaCorta(actividad.fechaInicio);
    if (!actividad.fechaFin) return `${inicio} · en curso`;
    return `${inicio} – ${this.fechaCorta(actividad.fechaFin)}`;
  }
  rangoTexto(): string {
    const total = this.filtradas().length;
    const inicio = total ? (this.pagina() - 1) * this.porPagina + 1 : 0;
    return `Mostrando ${inicio}–${Math.min(this.pagina() * this.porPagina, total)} de ${total} campañas`;
  }

  diaCalendario(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    return fecha ? String(fecha.getDate()).padStart(2, '0') : '—';
  }

  mesCalendario(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    return fecha
      ? fecha.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase()
      : '—';
  }

  hoyTexto(): string {
    return new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  fechaCorta(valor: string | null | undefined): string {
    const fecha = this.aFecha(valor);
    if (!fecha) return 'Sin fecha';
    const opciones: Intl.DateTimeFormatOptions =
      fecha.getFullYear() === new Date().getFullYear()
        ? { day: '2-digit', month: 'short' }
        : { day: '2-digit', month: 'short', year: 'numeric' };
    return fecha.toLocaleDateString('es-MX', opciones);
  }

  private aFecha(valor: string | null | undefined): Date | null {
    if (!valor) return null;
    const fecha = new Date(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private hoyISO(): string {
    const fecha = new Date();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private dosDigitos(valor: number): string {
    return String(valor).padStart(2, '0');
  }
}
