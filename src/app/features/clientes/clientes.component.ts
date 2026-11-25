import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ConfirmacionService } from '../../core/services/confirmacion.service';
import { SEGMENTOS_CLIENTE, badgeDe, etiquetaDe } from '../../core/models/estados';
import { ClienteApi, SegmentoCliente } from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { ModalAccesibleDirective } from '../../shared/modal-accesible.directive';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-clientes',
  imports: [ReactiveFormsModule, ModalAccesibleDirective],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientesComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly segmentos = SEGMENTOS_CLIENTE;
  readonly clientes = signal<ClienteApi[]>([]);
  readonly todos = signal<ClienteApi[]>([]);
  readonly seleccionado = signal<ClienteApi | null>(null);
  readonly cargando = signal(false);
  readonly cargandoTodos = signal(true);
  readonly error = signal<string | null>(null);
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly total = signal(0);
  readonly formularioAbierto = signal(false);
  readonly editando = signal<ClienteApi | null>(null);
  readonly guardando = signal(false);
  readonly notaAbierta = signal(false);

  readonly puedeGestionar = computed(() => this.auth.puedeEditarClientes());
  readonly puedeDesactivar = computed(() => this.auth.tieneRol('admin'));

  readonly filtros = this.fb.nonNullable.group({
    q: [''],
    segmento: [''],
    estado: [''],
  });

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    empresa: [''],
    correo: ['', [Validators.required, Validators.email]],
    telefono: [''],
    rfc: [''],
    direccion: [''],
    segmento: ['particular' as SegmentoCliente, [Validators.required]],
    notas: [''],
    activo: [true],
  });

  readonly notaForm = this.fb.nonNullable.group({ nota: ['', [Validators.required]] });

  readonly estadisticas = computed(() => {
    const todos = this.todos();
    const activos = todos.filter((cliente) => cliente.activo).length;
    const ahora = new Date();
    const nuevos = todos.filter((cliente) => {
      const fecha = new Date(cliente.fechaRegistro);
      return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    }).length;
    const pedidos = todos.reduce((total, cliente) => total + (cliente.totalPedidos ?? 0), 0);
    const facturado = todos.reduce((total, cliente) => total + (cliente.totalFacturado ?? 0), 0);
    const recurrentes = todos.filter((cliente) => (cliente.totalPedidos ?? 0) > 1).length;
    const conPedidos = todos.filter((cliente) => (cliente.totalPedidos ?? 0) > 0).length;

    return [
      {
        icono: 'bi-people',
        tono: 'icon-tile-cyan',
        valor: String(activos),
        etiqueta: 'Clientes activos',
      },
      {
        icono: 'bi-person-plus',
        tono: 'icon-tile-magenta',
        valor: String(nuevos),
        etiqueta: 'Nuevos este mes',
      },
      {
        icono: 'bi-receipt-cutoff',
        tono: 'icon-tile-yellow',
        valor: this.moneda(pedidos ? facturado / pedidos : 0),
        etiqueta: 'Ticket promedio',
      },
      {
        icono: 'bi-arrow-repeat',
        tono: 'icon-tile-success',
        valor: `${conPedidos ? Math.round((recurrentes / conPedidos) * 100) : 0}%`,
        etiqueta: 'Tasa de recompra',
      },
    ];
  });

  readonly distribucion = computed(() => {
    const todos = this.todos();
    const total = Math.max(1, todos.length);
    return SEGMENTOS_CLIENTE.map((segmento) => {
      const cantidad = todos.filter((cliente) => cliente.segmento === segmento.valor).length;
      return {
        ...segmento,
        cantidad,
        porcentaje: Math.max(4, Math.round((cantidad / total) * 100)),
      };
    });
  });

  readonly notas = computed(() => {
    const texto = this.seleccionado()?.notas ?? '';
    return texto
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .reverse();
  });

  readonly listaPaginas = computed(() => {
    const total = this.paginas();
    const actual = this.pagina();
    const desde = Math.max(1, actual - 2);
    const hasta = Math.min(total, desde + 4);
    return Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);
  });

  ngOnInit(): void {
    this.cargarTodos();
    this.cargar(1);
  }

  cargarTodos(): void {
    this.cargandoTodos.set(true);
    this.service
      .listarClientes({ page: 1, perPage: 100 })
      .pipe(finalize(() => this.cargandoTodos.set(false)))
      .subscribe({
        next: (respuesta) => this.todos.set(respuesta.items),
        error: () => this.todos.set([]),
      });
  }

  cargar(page = 1): void {
    this.cargando.set(true);
    this.error.set(null);
    const valores = this.filtros.getRawValue();
    this.service
      .listarClientes({
        q: valores.q.trim() || undefined,
        segmento: valores.segmento || undefined,
        activo:
          valores.estado === 'activo' ? true : valores.estado === 'inactivo' ? false : undefined,
        page,
        perPage: 10,
      })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.clientes.set(respuesta.items);
          this.pagina.set(respuesta.pagina);
          this.paginas.set(respuesta.paginas);
          this.total.set(respuesta.total);
          const actual = this.seleccionado();
          const vigente = respuesta.items.find((cliente) => cliente.id === actual?.id);
          this.seleccionado.set(vigente ?? respuesta.items[0] ?? null);
        },
        error: (error) => {
          this.error.set(this.ui.mensajeDeError(error, 'No pudimos cargar el directorio.'));
        },
      });
  }

  seleccionar(cliente: ClienteApi): void {
    this.seleccionado.set(cliente);
    this.notaAbierta.set(false);
    this.notaForm.reset({ nota: '' });
  }

  buscar(): void {
    this.cargar(1);
  }

  limpiar(): void {
    this.filtros.reset({ q: '', segmento: '', estado: '' });
    this.cargar(1);
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.formulario.reset({
      nombre: '',
      empresa: '',
      correo: '',
      telefono: '',
      rfc: '',
      direccion: '',
      segmento: 'particular',
      notas: '',
      activo: true,
    });
    this.formularioAbierto.set(true);
  }

  abrirEditar(cliente: ClienteApi): void {
    this.editando.set(cliente);
    this.formulario.reset({
      nombre: cliente.nombre,
      empresa: cliente.empresa ?? '',
      correo: cliente.correo,
      telefono: cliente.telefono ?? '',
      rfc: cliente.rfc ?? '',
      direccion: cliente.direccion ?? '',
      segmento: cliente.segmento,
      notas: cliente.notas ?? '',
      activo: cliente.activo,
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
    const edicion = this.editando();
    this.guardando.set(true);
    const peticion = edicion
      ? this.service.actualizarCliente(edicion.id, valores)
      : this.service.crearCliente(valores);

    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (cliente) => {
        this.ui.exito(edicion ? 'Cliente actualizado.' : 'Cliente registrado.');
        this.cerrarFormulario();
        this.cargar(edicion ? this.pagina() : 1);
        this.cargarTodos();
        this.seleccionado.set(cliente);
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos guardar el cliente.')),
    });
  }

  async desactivar(cliente: ClienteApi): Promise<void> {
    const confirmado = await this.confirmacion.confirmar({
      titulo: 'Desactivar cliente',
      mensaje: `¿Desactivar a ${cliente.nombre}? Su historial de compras y notas se conservará.`,
      confirmar: 'Desactivar',
      peligro: true,
    });
    if (!confirmado) return;

    this.service.desactivarCliente(cliente.id).subscribe({
      next: () => {
        this.ui.exito('Cliente desactivado.');
        this.cargar(this.pagina());
        this.cargarTodos();
      },
      error: (error) =>
        this.ui.error(this.ui.mensajeDeError(error, 'No pudimos desactivar el cliente.')),
    });
  }

  agregarNota(): void {
    const cliente = this.seleccionado();
    if (!cliente || this.notaForm.invalid) return;
    const autor = this.auth.usuario()?.nombre ?? 'Equipo';
    const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    const nueva = `[${fecha} · ${autor}] ${this.notaForm.getRawValue().nota.trim()}`;
    const notas = [cliente.notas, nueva].filter(Boolean).join('\n');

    this.service.actualizarCliente(cliente.id, { notas }).subscribe({
      next: (actualizado) => {
        this.seleccionado.set(actualizado);
        this.todos.update((lista) =>
          lista.map((fila) =>
            fila.id === actualizado.id ? { ...fila, notas: actualizado.notas } : fila,
          ),
        );
        this.clientes.update((lista) =>
          lista.map((fila) =>
            fila.id === actualizado.id ? { ...fila, notas: actualizado.notas } : fila,
          ),
        );
        this.notaForm.reset({ nota: '' });
        this.notaAbierta.set(false);
        this.ui.exito('Nota agregada al expediente.');
      },
      error: (error) => this.ui.error(this.ui.mensajeDeError(error, 'No pudimos guardar la nota.')),
    });
  }

  exportar(): void {
    const filas = [
      [
        'Nombre',
        'Empresa',
        'Correo',
        'Teléfono',
        'RFC',
        'Segmento',
        'Pedidos',
        'Facturado',
        'Activo',
      ],
      ...this.todos().map((cliente) => [
        cliente.nombre,
        cliente.empresa ?? '',
        cliente.correo,
        cliente.telefono ?? '',
        cliente.rfc ?? '',
        this.etiquetaSegmento(cliente.segmento),
        String(cliente.totalPedidos ?? 0),
        String(cliente.totalFacturado ?? 0),
        cliente.activo ? 'Sí' : 'No',
      ]),
    ];
    const csv = filas.map((fila) => fila.map((celda) => `"${celda}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'clientes-llamma.csv';
    enlace.click();
    URL.revokeObjectURL(url);
    this.ui.exito('Directorio exportado.');
  }

  rangoTexto(): string {
    const inicio = this.total() ? (this.pagina() - 1) * 10 + 1 : 0;
    return `Mostrando ${inicio}-${Math.min(this.pagina() * 10, this.total())} de ${this.total()} clientes`;
  }

  clasePagina(numero: number): string {
    const base = 'relative block border px-2 py-1 text-[0.76rem] no-underline transition';
    return numero === this.pagina()
      ? `${base} z-10 border-neutral-900 bg-neutral-900 text-white`
      : `${base} border-[var(--llamma-line)] text-[var(--llamma-carbon)] hover:bg-[rgba(var(--llamma-magenta-rgb),0.06)] hover:text-[var(--llamma-magenta)]`;
  }

  etiquetaSegmento(segmento: string): string {
    return etiquetaDe(SEGMENTOS_CLIENTE, segmento);
  }

  claseSegmento(segmento: string): string {
    return badgeDe(SEGMENTOS_CLIENTE, segmento);
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

  avatar(id: number): string {
    return ['avatar-cyan', 'avatar-magenta', 'avatar-yellow', 'avatar-ink'][id % 4];
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(Number(valor ?? 0));
  }

  fechaCorta(valor: string | null | undefined): string {
    if (!valor) return 'Sin fecha';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  ticket(cliente: ClienteApi): string {
    const pedidos = cliente.totalPedidos ?? 0;
    return this.moneda(pedidos ? (cliente.totalFacturado ?? 0) / pedidos : 0);
  }
}
