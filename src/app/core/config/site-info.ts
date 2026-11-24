/**
 * Datos públicos del negocio.
 *
 * Los campos vacíos no se renderizan en el portal. Al confirmar teléfono,
 * WhatsApp, dirección u horario basta con completarlos aquí.
 */
export const SITE_INFO = {
  nombre: 'Llamma',
  lema: 'Imprimimos tus ideas',
  descripcion:
    'Imprenta y estudio de producción: gran formato, línea textil, promocionales y papelería creativa.',
  correo: 'soporte@llamma.mx',
  telefono: '',
  whatsapp: '',
  direccion: '',
  horario: '',
} as const;

export interface CasoPortafolio {
  titulo: string;
  descripcion: string;
  linea: string;
  cliente?: string;
  imagen?: string;
  enlace?: string;
}

export interface Testimonio {
  texto: string;
  autor: string;
  empresa?: string;
  cargo?: string;
}

/**
 * Prueba social del portal. Se deja vacía a propósito: solo se publican
 * proyectos y testimonios reales, con autorización del cliente. Al capturar
 * elementos aquí aparecen automáticamente en la portada.
 */
export const PORTAFOLIO: readonly CasoPortafolio[] = [
  {
    titulo: 'Playera conmemorativa',
    descripcion: 'Diseño de alto contraste con estampado DTF sobre algodón negro.',
    linea: 'Línea textil',
    imagen: 'assets/images/portafolio/textil/playera-conmemorativa.webp',
  },
  {
    titulo: 'Taza con monograma',
    descripcion: 'Inicial serigrafiada en dorado sobre cerámica blanca.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-monograma-b.webp',
  },
  {
    titulo: 'Playera tipográfica',
    descripcion: 'Lettering personalizado con acabado suave y resistente al lavado.',
    linea: 'Línea textil',
    imagen: 'assets/images/portafolio/textil/playera-ricardo.webp',
  },
  {
    titulo: 'Taza para hermanos',
    descripcion: 'Ilustración personalizada a dos caras para un regalo único.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-hermanos.webp',
  },
  {
    titulo: 'Playera editorial',
    descripcion: 'Composición tipográfica de gran formato para equipo o evento.',
    linea: 'Línea textil',
    imagen: 'assets/images/portafolio/textil/playera-thrastre.webp',
  },
  {
    titulo: 'Taza con mensaje',
    descripcion: 'Frase y lettering a color para sorprender en familia.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-regalo.webp',
  },
  {
    titulo: 'Playera de autor',
    descripcion: 'Ilustración monocromática con detalle fino y caída uniforme.',
    linea: 'Línea textil',
    imagen: 'assets/images/portafolio/textil/playera-cruz.webp',
  },
  {
    titulo: 'Taza con monograma J',
    descripcion: 'Monograma dorado con acabado premium sobre cerámica.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-monograma-j.webp',
  },
  {
    titulo: 'Taza con fotografía',
    descripcion: 'Fotografía familiar impresa en alta definición y acabado brillante.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-foto.webp',
  },
  {
    titulo: 'Taza familiar',
    descripcion: 'Diseño a todo color con fotografía y marco de rayas.',
    linea: 'Promocionales',
    imagen: 'assets/images/portafolio/promocionales/taza-familiar.webp',
  },
];
export const TESTIMONIOS: readonly Testimonio[] = [];
