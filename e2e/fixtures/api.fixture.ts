import fs from 'node:fs';
import path from 'node:path';

import type { Rol } from './auth.fixture';

/** Lee el token guardado por `global-setup.ts` para preparar datos por API. */
export function tokenDe(rol: Exclude<Rol, 'anonimo'>): string {
  const archivo = path.join('e2e/.auth', `${rol}.json`);
  const estado = JSON.parse(fs.readFileSync(archivo, 'utf8')) as {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
  const entrada = estado.origins[0]?.localStorage.find((item) => item.name === 'llamma.session.v1');
  if (!entrada) throw new Error(`No hay sesión guardada para ${rol}`);
  return JSON.parse(entrada.value).token as string;
}
