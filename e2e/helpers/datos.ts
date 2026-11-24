let contador = 0;

/** Sufijo único y estable dentro de una ejecución (sin depender de faker). */
export function unico(prefijo = 'e2e'): string {
  contador += 1;
  return `${prefijo}-${Date.now().toString(36)}-${contador}`;
}

export function correoUnico(prefijo = 'qa'): string {
  return `${prefijo}.${unico('mail')}@example.com`;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
