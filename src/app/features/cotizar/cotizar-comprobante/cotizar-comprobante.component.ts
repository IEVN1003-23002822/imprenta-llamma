import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CellDef, RowInput } from 'jspdf-autotable';

import { SITE_INFO } from '../../../core/config/site-info';
import {
  ItemSolicitud,
  MetodoEntrega,
  SegmentoCliente,
  SolicitudCotizacion,
} from '../../../core/models/llamma.models';

const MARGEN = 15;
const ANCHO_A4 = 210;
const ALTO_A4 = 297;
const PIE_ALTO = 24;

const CARBON: [number, number, number] = [26, 26, 26];
const GRIS: [number, number, number] = [112, 112, 112];
const GRIS_CLARO: [number, number, number] = [150, 150, 150];
const LINEA: [number, number, number] = [223, 221, 214];
const PAPEL: [number, number, number] = [250, 249, 245];
const CIAN: [number, number, number] = [0, 174, 239];
const MAGENTA: [number, number, number] = [236, 0, 140];
const AMARILLO: [number, number, number] = [255, 242, 0];

/** Confirmación posterior al envío de una solicitud de cotización. */
@Component({
  selector: 'app-cotizar-comprobante',
  imports: [RouterLink],
  templateUrl: './cotizar-comprobante.component.html',
  styleUrl: './cotizar-comprobante.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizarComprobanteComponent {
  readonly folio = input.required<string>();
  readonly solicitud = input<SolicitudCotizacion | null>(null);
  readonly partidas = input<ItemSolicitud[]>([]);
  readonly totalPiezas = input(0);
  readonly totalConIva = input(0);
  readonly correo = input('');
  readonly copiado = input(false);

  readonly copiar = output<void>();
  readonly nueva = output<void>();

  readonly generandoPdf = signal(false);
  readonly errorPdf = signal<string | null>(null);

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
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

  /** Genera un PDF vectorial A4 con jsPDF y descarga el comprobante. */
  async descargarComprobante(): Promise<void> {
    if (this.generandoPdf()) return;
    const folio = this.folio();
    if (!folio) return;

    this.generandoPdf.set(true);
    this.errorPdf.set(null);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const logo = await this.cargarLogo();

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      doc.setProperties({
        title: `Comprobante de solicitud ${folio} · Llamma`,
        subject: 'Comprobante de solicitud de cotización',
        author: 'Llamma',
        creator: 'Portal Llamma',
      });

      let y = this.dibujarCabecera(doc, folio, logo);
      y = this.dibujarFolio(doc, y, folio);
      y = this.dibujarDatosCliente(doc, y);

      const partidas = this.partidas();
      const total = this.totalConIva();
      const subtotal = partidas.length
        ? Math.round(partidas.reduce((suma, item) => suma + (item.precioEstimado ?? 0), 0) * 100) /
          100
        : Math.round((total / 1.16) * 100) / 100;
      const iva = Math.round((total - subtotal) * 100) / 100;

      y = this.dibujarTituloSeccion(doc, y + 2, 'Partidas solicitadas');
      autoTable(doc, {
        startY: y,
        head: [['Cant.', 'Producto', 'Especificaciones', 'Total estimado']],
        body: this.filasPartidas(partidas),
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 8.4,
          cellPadding: 2.6,
          textColor: CARBON,
          lineColor: LINEA,
          lineWidth: 0.2,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: CARBON,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        alternateRowStyles: { fillColor: PAPEL },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { cellWidth: 58 },
          2: { cellWidth: 72, textColor: GRIS },
          3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
        },
        margin: { left: MARGEN, right: MARGEN, top: 25, bottom: PIE_ALTO },
        didDrawPage: (datos: { pageNumber: number }) => {
          if (datos.pageNumber > 1) this.dibujarCabeceraCompacta(doc, folio);
          this.dibujarPie(doc);
        },
      });

      const salida = doc as unknown as { lastAutoTable?: { finalY?: number } };
      y = (salida.lastAutoTable?.finalY ?? y) + 6;

      y = this.dibujarResumen(doc, y, subtotal, iva, total);
      y = this.dibujarMensaje(doc, y + 6);
      this.dibujarCondiciones(doc, y + 4);

      doc.save(`Comprobante_${folio}_Llamma.pdf`);
    } catch {
      this.errorPdf.set('No pudimos generar el PDF. Intenta de nuevo en un momento.');
    } finally {
      this.generandoPdf.set(false);
    }
  }

  private filasPartidas(partidas: ItemSolicitud[]): RowInput[] {
    if (!partidas.length) {
      const aviso: CellDef = {
        content: 'Sin partidas de catálogo: la solicitud se describió en el mensaje.',
        colSpan: 4,
        styles: { fontStyle: 'italic', textColor: GRIS, halign: 'left' },
      };
      return [[aviso]];
    }
    return partidas.map((item) => [
      this.formatoCantidad(item.cantidad),
      this.limpio(item.nombreProducto),
      this.limpio(item.especificaciones || 'Por confirmar con el cliente'),
      item.precioEstimado == null ? 'Por cotizar' : this.importe(item.precioEstimado),
    ]);
  }

  private dibujarCabecera(
    doc: import('jspdf').jsPDF,
    folio: string,
    logo: { dataUrl: string; width: number; height: number; formato: 'JPEG' | 'PNG' } | null,
  ): number {
    if (logo) {
      const alto = 17;
      const ancho = (logo.width / logo.height) * alto;
      doc.addImage(logo.dataUrl, logo.formato, MARGEN, 12, ancho, alto);
    } else {
      doc.setFillColor(...CIAN);
      doc.roundedRect(MARGEN, 12, 12, 17, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('LL', MARGEN + 6, 22.5, { align: 'center' });
    }

    const xTexto = 30;
    doc.setTextColor(...CARBON);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text('LLAMMA', xTexto, 21);
    doc.setCharSpace(1.15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...GRIS);
    doc.text('IMPRIMIMOS TUS IDEAS', xTexto, 26);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...GRIS_CLARO);
    doc.text('COMPROBANTE DE', ANCHO_A4 - MARGEN, 15.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...CARBON);
    doc.text('SOLICITUD', ANCHO_A4 - MARGEN, 21.2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...GRIS);
    doc.text(`Emitido el ${this.fecha(new Date().toISOString())}`, ANCHO_A4 - MARGEN, 26, {
      align: 'right',
    });

    this.dibujarFranja(doc, 34.5);
    return 40;
  }

  private dibujarFranja(doc: import('jspdf').jsPDF, y: number): void {
    const ancho = ANCHO_A4 - MARGEN * 2;
    const tercio = ancho / 3;
    const colores = [CIAN, MAGENTA, AMARILLO];
    colores.forEach((color, indice) => {
      doc.setFillColor(...color);
      doc.rect(MARGEN + tercio * indice, y, tercio, 1.6, 'F');
    });
  }

  private dibujarFolio(doc: import('jspdf').jsPDF, y: number, folio: string): number {
    const ancho = ANCHO_A4 - MARGEN * 2;
    doc.setFillColor(...PAPEL);
    doc.setDrawColor(...CIAN);
    doc.setLineWidth(0.45);
    doc.roundedRect(MARGEN, y, ancho, 16, 2.4, 2.4, 'DF');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(...GRIS);
    doc.setCharSpace(0.8);
    doc.text('FOLIO DE SEGUIMIENTO', MARGEN + 5, y + 5.4);
    doc.setCharSpace(0);

    doc.setFontSize(15.5);
    doc.setTextColor(...CARBON);
    doc.text(folio, MARGEN + 5, y + 12.2);

    doc.setFillColor(...CIAN);
    doc.roundedRect(ANCHO_A4 - MARGEN - 27, y + 4.2, 22, 7.4, 3.7, 3.7, 'F');
    doc.setFontSize(6.6);
    doc.setTextColor(255, 255, 255);
    doc.text('RECIBIDA', ANCHO_A4 - MARGEN - 16, y + 8.9, { align: 'center' });

    return y + 22;
  }

  private dibujarDatosCliente(doc: import('jspdf').jsPDF, y: number): number {
    const solicitud = this.solicitud();
    const columnaDerecha = MARGEN + 100;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(...GRIS);
    doc.setCharSpace(0.7);
    doc.text('CLIENTE', MARGEN, y);
    doc.text('DATOS DE LA SOLICITUD', columnaDerecha, y);
    doc.setCharSpace(0);

    doc.setFontSize(10.4);
    doc.setTextColor(...CARBON);
    doc.text(
      this.recortar(doc, this.limpio(solicitud?.nombreCliente || 'Cliente del portal'), 94),
      MARGEN,
      y + 5.4,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(
      this.recortar(doc, this.limpio(this.correo() || solicitud?.correo || 'Sin correo'), 94),
      MARGEN,
      y + 10.2,
    );
    const telefono = solicitud?.telefono?.trim();
    if (telefono) doc.text(this.recortar(doc, this.limpio(telefono), 94), MARGEN, y + 14.4);
    doc.text(
      `Tipo de cliente: ${this.etiquetaSegmento(solicitud?.segmento)}`,
      MARGEN,
      y + (telefono ? 18.6 : 14.4),
    );

    const filas: Array<[string, string]> = [
      ['Método de entrega', this.etiquetaEntrega(solicitud?.metodoEntrega)],
      ['Fecha deseada', this.fecha(solicitud?.fechaDeseada)],
      ['Piezas / unidades', this.formatoCantidad(this.totalPiezas())],
    ];
    filas.forEach(([etiqueta, valor], indice) => {
      const filaY = y + 6.2 + indice * 5.8;
      doc.setFontSize(6.6);
      doc.setTextColor(...GRIS_CLARO);
      doc.text(etiqueta.toUpperCase(), columnaDerecha, filaY);
      doc.setFontSize(8.4);
      doc.setTextColor(...CARBON);
      doc.text(this.limpio(valor), columnaDerecha + 38, filaY);
    });

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y + 24, ANCHO_A4 - MARGEN, y + 24);
    return y + 29;
  }

  private dibujarTituloSeccion(doc: import('jspdf').jsPDF, y: number, titulo: string): number {
    doc.setFillColor(...MAGENTA);
    doc.rect(MARGEN, y - 3.1, 1.3, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...CARBON);
    doc.text(titulo, MARGEN + 4, y);
    return y + 3;
  }

  private dibujarResumen(
    doc: import('jspdf').jsPDF,
    y: number,
    subtotal: number,
    iva: number,
    total: number,
  ): number {
    if (y + 34 > ALTO_A4 - PIE_ALTO) {
      doc.addPage();
      this.dibujarCabeceraCompacta(doc, this.folio());
      this.dibujarPie(doc);
      y = 34;
    }

    const ancho = 86;
    const x = ANCHO_A4 - MARGEN - ancho;
    const alto = 31;
    doc.setFillColor(...PAPEL);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, ancho, alto, 2, 2, 'DF');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...GRIS);
    doc.text('Subtotal', x + 5, y + 7);
    doc.text('IVA (16%)', x + 5, y + 13.4);
    doc.setTextColor(...CARBON);
    doc.text(this.importe(subtotal), x + ancho - 5, y + 7, { align: 'right' });
    doc.text(this.importe(iva), x + ancho - 5, y + 13.4, { align: 'right' });

    doc.setDrawColor(...LINEA);
    doc.line(x + 5, y + 17.4, x + ancho - 5, y + 17.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.6);
    doc.text('Total estimado', x + 5, y + 25);
    doc.setFontSize(11.4);
    doc.text(this.importe(total), x + ancho - 5, y + 25, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...GRIS_CLARO);
    doc.text('IVA incluido · precios referenciales', x + ancho / 2, y + 29, { align: 'center' });

    return y + alto;
  }

  private dibujarMensaje(doc: import('jspdf').jsPDF, y: number): number {
    const mensaje = this.solicitud()?.mensaje?.trim();
    const ancho = ANCHO_A4 - MARGEN * 2;
    const lineas = doc.splitTextToSize(
      this.limpio(mensaje || 'Sin mensaje adicional del cliente.'),
      ancho - 10,
    ) as string[];
    const alto = 10 + lineas.length * 4.3;

    if (y + alto + 8 > ALTO_A4 - PIE_ALTO) {
      doc.addPage();
      this.dibujarCabeceraCompacta(doc, this.folio());
      this.dibujarPie(doc);
      y = 34;
    }

    y = this.dibujarTituloSeccion(doc, y, 'Mensaje del proyecto');
    doc.setFillColor(...PAPEL);
    doc.setDrawColor(...LINEA);
    doc.roundedRect(MARGEN, y, ancho, alto, 2, 2, 'DF');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.4);
    doc.setTextColor(...GRIS);
    doc.text(lineas, MARGEN + 5, y + 6, { lineHeightFactor: 1.5 });

    return y + alto;
  }

  private dibujarCondiciones(doc: import('jspdf').jsPDF, y: number): number {
    const clausulas = [
      'Los precios son referenciales, incluyen IVA y están sujetos a revisión de diseño y materiales.',
      'La entrega se agenda a partir de 2 días hábiles después de aprobar el diseño y el anticipo.',
      `Conserva tu folio y consúltalo en ${SITE_INFO.nombre.toLowerCase()}.mx/seguimiento con tu correo.`,
    ];
    const lineas = clausulas.flatMap((clausula) =>
      (doc.splitTextToSize(this.limpio(clausula), ANCHO_A4 - MARGEN * 2 - 6) as string[]).map(
        (linea, indice, todas) => ({
          linea,
          primera: indice === 0,
          ultima: indice === todas.length - 1,
        }),
      ),
    );
    const alto = 8 + lineas.length * 4;
    if (y + alto > ALTO_A4 - PIE_ALTO) {
      doc.addPage();
      this.dibujarCabeceraCompacta(doc, this.folio());
      this.dibujarPie(doc);
      y = 34;
    }

    y = this.dibujarTituloSeccion(doc, y, 'Condiciones de la solicitud');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);

    let cursor = y + 3;
    lineas.forEach(({ linea, primera, ultima }) => {
      if (primera) {
        doc.setFillColor(...CIAN);
        doc.circle(MARGEN + 1.2, cursor - 1.1, 0.8, 'F');
      }
      doc.text(linea, MARGEN + 4, cursor);
      cursor += 4;
      if (ultima) cursor += 1.2;
    });

    return cursor;
  }

  private dibujarCabeceraCompacta(doc: import('jspdf').jsPDF, folio: string): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...CARBON);
    doc.text('LLAMMA', MARGEN, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...GRIS);
    doc.text(`Comprobante de solicitud ${folio}`, ANCHO_A4 - MARGEN, 13, { align: 'right' });
    this.dibujarFranja(doc, 16.2);
  }

  private dibujarPie(doc: import('jspdf').jsPDF): void {
    const ancho = ANCHO_A4 - MARGEN * 2;
    const y = ALTO_A4 - 17;

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y, ANCHO_A4 - MARGEN, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(
      'Entregas a partir de 2 días hábiles tras aprobar diseño y anticipo.',
      MARGEN,
      y + 4.2,
    );

    const contacto = [
      `${SITE_INFO.nombre.toLowerCase()}.mx`,
      SITE_INFO.correo,
      SITE_INFO.telefono ? `Tel. ${SITE_INFO.telefono}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    doc.text(contacto, MARGEN, y + 8.4);

    const pagina = doc.getCurrentPageInfo().pageNumber;
    doc.text(`Página ${pagina}`, ANCHO_A4 - MARGEN, y + 8.4, { align: 'right' });

    const tercio = ancho / 3;
    [CIAN, MAGENTA, AMARILLO].forEach((color, indice) => {
      doc.setFillColor(...color);
      doc.rect(MARGEN + tercio * indice, ALTO_A4 - 5, tercio, 1.4, 'F');
    });
  }

  /** Convierte el logo a data URL para que jsPDF no dependa de CORS ni del canvas. */
  private async cargarLogo(): Promise<{
    dataUrl: string;
    width: number;
    height: number;
    formato: 'JPEG' | 'PNG';
  } | null> {
    try {
      const url = new URL('assets/images/logo-llamma.png', document.baseURI).href;
      const respuesta = await fetch(url);
      if (!respuesta.ok) return null;
      const blob = await respuesta.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result ?? ''));
        lector.onerror = () => reject(new Error('logo_ilegible'));
        lector.readAsDataURL(blob);
      });
      const dimensiones = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const imagen = new Image();
          imagen.onload = () =>
            resolve({ width: imagen.naturalWidth || 1, height: imagen.naturalHeight || 1 });
          imagen.onerror = () => reject(new Error('logo_invalido'));
          imagen.src = dataUrl;
        },
      );

      // Reduce el PNG original (813×1171) para que el PDF no pese varios MB.
      const alto = 220;
      const ancho = Math.max(1, Math.round((dimensiones.width / dimensiones.height) * alto));
      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { dataUrl, ...dimensiones, formato: 'PNG' };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ancho, alto);

      const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
        const elemento = new Image();
        elemento.onload = () => resolve(elemento);
        elemento.onerror = () => reject(new Error('logo_invalido'));
        elemento.src = dataUrl;
      });
      ctx.drawImage(imagen, 0, 0, ancho, alto);

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: ancho,
        height: alto,
        formato: 'JPEG',
      };
    } catch {
      return null;
    }
  }

  private importe(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  }

  private formatoCantidad(valor: number): string {
    const redondeado = Math.round(valor * 100) / 100;
    return Number.isInteger(redondeado)
      ? String(redondeado)
      : redondeado.toFixed(2).replace(/0$/, '');
  }

  private etiquetaSegmento(segmento: SegmentoCliente | null | undefined): string {
    const etiquetas: Record<SegmentoCliente, string> = {
      particular: 'Particular',
      pyme: 'PyME',
      corporativo: 'Corporativo',
      escolar: 'Escolar',
      gobierno: 'Gobierno',
      eventos: 'Eventos',
      otro: 'Otro',
    };
    return segmento ? etiquetas[segmento] : 'No especificado';
  }

  private etiquetaEntrega(metodo: MetodoEntrega | null | undefined): string {
    const etiquetas: Record<MetodoEntrega, string> = {
      taller: 'Recoger en taller',
      domicilio: 'Envío a domicilio',
      paqueteria: 'Paquetería nacional',
      instalacion: 'Instalación en sitio',
    };
    return metodo ? etiquetas[metodo] : 'Por confirmar';
  }

  private limpio(valor: string): string {
    return valor
      .replace(/\u00a0/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/…/g, '...');
  }

  /** Recorta una línea larga con puntos suspensivos para que no invada otra columna. */
  private recortar(doc: import('jspdf').jsPDF, texto: string, ancho: number): string {
    if (doc.getTextWidth(texto) <= ancho) return texto;
    let corte = texto;
    while (corte.length > 1 && doc.getTextWidth(`${corte}...`) > ancho) {
      corte = corte.slice(0, -1);
    }
    return `${corte.trimEnd()}...`;
  }
}
