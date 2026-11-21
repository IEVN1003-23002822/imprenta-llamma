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
export const PORTAFOLIO: readonly CasoPortafolio[] = [];
export const TESTIMONIOS: readonly Testimonio[] = [];
