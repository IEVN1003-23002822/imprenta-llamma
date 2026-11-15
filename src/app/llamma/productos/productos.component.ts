import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { LlammaService } from '../llamma.service';
import { LineaProduccion, ProductoPublico, UnidadMedida } from '../llamma.models';

const LINEAS: { clave: LineaProduccion | ''; etiqueta: string }[] = [
  { clave: '', etiqueta: 'Todas las líneas' },
  { clave: 'gran-formato', etiqueta: 'Gran formato' },
  { clave: 'textil', etiqueta: 'Textil' },
  { clave: 'promocionales', etiqueta: 'Promocionales' },
  { clave: 'papeleria', etiqueta: 'Papelería' },
];

const UNIDADES: Record<UnidadMedida, string> = {
  m2: 'm²',
  ml: 'ml',
  pieza: 'pieza',
  hoja: 'hoja',
  kg: 'kg',
  litro: 'litro',
};

/** Catálogo público: solo datos comerciales, sin costos ni inventario interno. */
@Component({
  selector: 'app-productos',
  imports: [RouterLink],
  templateUrl: './productos.component.html',
  styleUrl: './productos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductosComponent implements OnInit {
  private readonly service = inject(LlammaService);

  readonly productos = signal<ProductoPublico[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly linea = signal<LineaProduccion | ''>('');
  readonly busqueda = signal('');

  readonly lineas = LINEAS;

  readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.productos().filter((producto) => {
      const coincideLinea = !this.linea() || producto.lineaProduccion === this.linea();
      const coincideTexto =
        !texto ||
        producto.nombre.toLowerCase().includes(texto) ||
        (producto.descripcion ?? '').toLowerCase().includes(texto);
      return coincideLinea && coincideTexto;
    });
  });

  ngOnInit(): void {
    this.service.listarProductosPublicos().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.items);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar el catálogo. Intenta de nuevo en un momento.');
        this.cargando.set(false);
      },
    });
  }

  filtrarPor(linea: LineaProduccion | ''): void {
    this.linea.set(linea);
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  unidad(unidad: UnidadMedida): string {
    return UNIDADES[unidad] ?? unidad;
  }

  etiquetaLinea(linea: LineaProduccion): string {
    return LINEAS.find((opcion) => opcion.clave === linea)?.etiqueta ?? linea;
  }
}
