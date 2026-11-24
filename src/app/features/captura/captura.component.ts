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

import { ESTADOS_COTIZACION, badgeDe, etiquetaDe } from '../../core/models/estados';
import { LlammaService } from '../../core/services/llamma.service';
import {
  Cotizacion,
  ItemCotizacion,
  ProductoPublico,
  SegmentoCliente,
  SolicitudCotizacion,
} from '../../core/models/llamma.models';

const redondear = (valor: number) => Math.round(valor * 100) / 100;

@Component({
  selector: 'app-captura',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './captura.component.html',
  styleUrl: './captura.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapturaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LlammaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly productos = signal<ProductoPublico[]>([]);
  readonly partidas = signal<ItemCotizacion[]>([]);
  readonly solicitud = signal<SolicitudCotizacion | null>(null);
  readonly cotizacion = signal<Cotizacion | null>(null);
  readonly creada = signal(false);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly convirtiendo = signal(false);
  readonly error = signal<string | null>(null);
  readonly pedidoCreado = signal<string | null>(null);
  readonly anticipoPagado = signal(false);

  readonly productoId = signal<number | null>(null);
  readonly descripcion = signal('');
  readonly especificaciones = signal('');
  readonly cantidad = signal(1);
  readonly precio = signal(0);

  readonly modoExistente = computed(() => this.cotizacion() !== null);

  readonly productoElegido = computed(
    () => this.productos().find((producto) => producto.id === this.productoId()) ?? null,
  );

  readonly subtotal = computed(() =>
    redondear(this.partidas().reduce((total, item) => total + item.importe, 0)),
  );
  readonly impuestos = computed(() => redondear(this.subtotal() * 0.16));
  readonly total = computed(() => redondear(this.subtotal() + this.impuestos()));
  readonly anticipo = computed(() => redondear(this.total() * 0.5));
  readonly saldo = computed(() => redondear(this.total() - this.anticipo()));
  readonly piezas = computed(() =>
    this.partidas().reduce((total, item) => total + item.cantidad, 0),
  );

  readonly yaConvertida = computed(() => this.cotizacion()?.estado === 'convertida');

  readonly form = this.fb.nonNullable.group({
    nombreCliente: ['', [Validators.required, Validators.minLength(3)]],
    empresa: [''],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required]],
    rfc: [''],
    direccion: [''],
    segmento: ['pyme' as SegmentoCliente],
    notas: [''],
    vigenciaDias: [15, [Validators.required, Validators.min(1), Validators.max(90)]],
  });

  ngOnInit(): void {
    const solicitudId = Number(this.route.snapshot.queryParamMap.get('solicitud'));
    const cotizacionId = Number(this.route.snapshot.queryParamMap.get('cotizacion'));

    this.service.listarProductos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.items);
        this.seleccionarPrimerProducto();
        this.resolverContexto(solicitudId, cotizacionId);
      },
      error: () => {
        this.error.set('No pudimos cargar el catálogo de productos.');
        this.resolverContexto(solicitudId, cotizacionId);
      },
    });
  }

  private resolverContexto(solicitudId: number, cotizacionId: number): void {
    if (Number.isFinite(solicitudId) && solicitudId > 0) {
      this.cargarSolicitud(solicitudId);
      return;
    }
    if (Number.isFinite(cotizacionId) && cotizacionId > 0) {
      this.cargarCotizacion(cotizacionId);
      return;
    }
    this.cargando.set(false);
  }

  private seleccionarPrimerProducto(): void {
    const primero = this.productos()[0];
    if (primero && this.productoId() === null) {
      this.productoId.set(primero.id);
      this.descripcion.set(primero.nombre);
      this.precio.set(primero.precioBase);
    }
  }

  private cargarSolicitud(id: number): void {
    this.cargando.set(true);
    this.service
      .detalleSolicitud(id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (solicitud) => {
          this.solicitud.set(solicitud);
          this.form.patchValue({
            nombreCliente: solicitud.nombreCliente,
            empresa: solicitud.empresa ?? '',
            correo: solicitud.correo,
            telefono: solicitud.telefono ?? '',
            segmento: solicitud.segmento,
            notas: solicitud.mensaje ?? '',
          });

          const partidas = (solicitud.itemsSolicitados ?? []).map((item) => {
            const producto = this.productos().find((p) => p.id === item.productoId);
            const cantidad = Math.max(item.cantidad, 1);
            const precioUnitario = producto
              ? producto.precioBase
              : redondear((item.precioEstimado ?? 0) / cantidad);
            return {
              productoId: item.productoId ?? null,
              descripcion: item.nombreProducto,
              especificaciones: item.especificaciones ?? '',
              cantidad,
              precioUnitario,
              importe: redondear(precioUnitario * cantidad),
            };
          });

          this.partidas.set(partidas);
          if (!partidas.length) {
            this.error.set(
              'Esta solicitud llegó solo con mensaje. Agrega las partidas que vas a cotizar.',
            );
          }
        },
        error: () => this.error.set('No pudimos cargar la solicitud seleccionada.'),
      });
  }

  private cargarCotizacion(id: number): void {
    this.cargando.set(true);
    this.service
      .detalleCotizacion(id)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion.set(cotizacion);
          this.partidas.set(cotizacion.items ?? []);
          this.form.patchValue({
            nombreCliente: cotizacion.cliente ?? '',
            notas: cotizacion.notas ?? '',
            vigenciaDias: cotizacion.vigenciaDias,
          });
        },
        error: () => this.error.set('No pudimos cargar la cotización seleccionada.'),
      });
  }

  cambiarProducto(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (!Number.isFinite(valor) || valor <= 0) {
      this.productoId.set(null);
      this.descripcion.set('');
      this.precio.set(0);
      return;
    }
    const producto = this.productos().find((p) => p.id === valor) ?? null;
    this.productoId.set(producto?.id ?? null);
    this.descripcion.set(producto?.nombre ?? '');
    this.precio.set(producto?.precioBase ?? 0);
  }

  cambiarDescripcion(evento: Event): void {
    this.descripcion.set((evento.target as HTMLInputElement).value);
  }

  cambiarEspecificaciones(evento: Event): void {
    this.especificaciones.set((evento.target as HTMLInputElement).value);
  }

  cambiarCantidad(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.cantidad.set(Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1);
  }

  cambiarPrecio(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.precio.set(Number.isFinite(valor) && valor >= 0 ? valor : 0);
  }

  agregarPartida(): void {
    const descripcion = this.descripcion().trim();
    if (!descripcion) {
      this.error.set('Escribe el concepto o elige un producto del catálogo.');
      return;
    }
    if (this.precio() <= 0) {
      this.error.set('Indica un precio unitario mayor a cero.');
      return;
    }

    const cantidad = Math.max(this.cantidad(), 1);
    const precioUnitario = redondear(this.precio());

    this.partidas.update((partidas) => [
      ...partidas,
      {
        productoId: this.productoId(),
        descripcion,
        especificaciones: this.especificaciones().trim(),
        cantidad,
        precioUnitario,
        importe: redondear(precioUnitario * cantidad),
      },
    ]);

    this.cantidad.set(1);
    this.especificaciones.set('');
    this.error.set(null);
  }

  actualizarCantidad(indice: number, evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    const cantidad = Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 1;
    this.partidas.update((partidas) =>
      partidas.map((item, posicion) =>
        posicion === indice
          ? { ...item, cantidad, importe: redondear(item.precioUnitario * cantidad) }
          : item,
      ),
    );
  }

  actualizarPrecio(indice: number, evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    const precioUnitario = Number.isFinite(valor) && valor >= 0 ? valor : 0;
    this.partidas.update((partidas) =>
      partidas.map((item, posicion) =>
        posicion === indice
          ? {
              ...item,
              precioUnitario,
              importe: redondear(precioUnitario * item.cantidad),
            }
          : item,
      ),
    );
  }

  quitarPartida(indice: number): void {
    this.partidas.update((partidas) => partidas.filter((_, posicion) => posicion !== indice));
  }

  guardar(): void {
    if (this.guardando() || this.modoExistente()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los datos del cliente: hay campos obligatorios pendientes.');
      return;
    }
    if (!this.partidas().length) {
      this.error.set('Agrega al menos una partida para generar la cotización.');
      return;
    }

    const valores = this.form.getRawValue();
    const solicitud = this.solicitud();

    this.guardando.set(true);
    this.error.set(null);

    this.service
      .crearCotizacion({
        solicitudId: solicitud?.id,
        nombreCliente: valores.nombreCliente.trim(),
        empresa: valores.empresa.trim() || undefined,
        correo: valores.correo.trim().toLowerCase(),
        telefono: valores.telefono.trim(),
        rfc: valores.rfc.trim() || undefined,
        direccion: valores.direccion.trim() || undefined,
        segmento: valores.segmento,
        notas: valores.notas.trim() || undefined,
        vigenciaDias: valores.vigenciaDias,
        estado: 'borrador',
        items: this.partidas().map((item) => ({
          productoId: item.productoId,
          descripcion: item.descripcion,
          especificaciones: item.especificaciones,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
      })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion.set(cotizacion);
          this.partidas.set(cotizacion.items ?? this.partidas());
          this.creada.set(true);
          window.scrollTo({ top: 0, behavior: 'auto' });
        },
        error: (respuesta: HttpErrorResponse) => {
          if (respuesta.status === 409 && respuesta.error?.cotizacion) {
            const existente = respuesta.error.cotizacion as Cotizacion;
            this.cotizacion.set(existente);
            this.partidas.set(existente.items ?? []);
            this.creada.set(true);
            this.error.set(
              `La solicitud ya tenía la cotización ${existente.folio}. Te mostramos la existente.`,
            );
            return;
          }
          this.error.set(
            respuesta.status === 0
              ? 'No pudimos conectar con el servidor. Intenta de nuevo.'
              : respuesta.error?.error || 'No pudimos guardar la cotización.',
          );
        },
      });
  }

  convertirAPedido(): void {
    const cotizacion = this.cotizacion();
    if (!cotizacion || this.convirtiendo() || this.yaConvertida()) return;

    this.convirtiendo.set(true);
    this.error.set(null);

    this.service
      .convertirCotizacionAPedido(cotizacion.id, {
        anticipoPagado: this.anticipoPagado(),
        metodoPago: 'transferencia',
        prioridad: 'media',
      })
      .pipe(finalize(() => this.convirtiendo.set(false)))
      .subscribe({
        next: (respuesta) => {
          const pedido = respuesta as { folio?: string };
          this.pedidoCreado.set(pedido?.folio ?? '');
          this.cotizacion.update((actual) =>
            actual ? { ...actual, estado: 'convertida' } : actual,
          );
        },
        error: (respuesta: HttpErrorResponse) => {
          this.error.set(respuesta.error?.error || 'No pudimos convertir la cotización en pedido.');
        },
      });
  }

  nuevaCotizacion(): void {
    this.cotizacion.set(null);
    this.creada.set(false);
    this.pedidoCreado.set(null);
    this.error.set(null);
    this.partidas.set([]);
    this.solicitud.set(null);
    this.form.reset({
      nombreCliente: '',
      empresa: '',
      correo: '',
      telefono: '',
      rfc: '',
      direccion: '',
      segmento: 'pyme',
      notas: '',
      vigenciaDias: 15,
    });
    this.router.navigate(['/captura'], { replaceUrl: true });
  }

  toggleAnticipo(evento: Event): void {
    this.anticipoPagado.set((evento.target as HTMLInputElement).checked);
  }

  etiquetaEstado(): string {
    return etiquetaDe(ESTADOS_COTIZACION, this.cotizacion()?.estado) || 'Borrador';
  }

  claseEstado(): string {
    return badgeDe(ESTADOS_COTIZACION, this.cotizacion()?.estado);
  }

  iniciales(nombre: string): string {
    return (nombre || 'LL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join('')
      .toUpperCase();
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor ?? 0);
  }

  fecha(valor: string | null | undefined): string {
    if (!valor) return 'Por confirmar';
    const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
