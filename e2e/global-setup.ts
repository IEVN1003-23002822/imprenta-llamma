import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:5001';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4300';

export const USUARIOS = {
  admin: { correo: 'ana@llamma.mx', password: 'llamma2026' },
  vendedor: { correo: 'diego@llamma.mx', password: 'llamma2026' },
  produccion: { correo: 'mariana@llamma.mx', password: 'llamma2026' },
  inventario: { correo: 'ivan@llamma.mx', password: 'llamma2026' },
  marketing: { correo: 'paola@llamma.mx', password: 'llamma2026' },
} as const;

/**
 * Inicia sesión por API y guarda el `storageState` que espera `AuthService`
 * (`llamma.session.v1`, no una clave de token suelta).
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  fs.mkdirSync('e2e/.auth', { recursive: true });
  const api = await request.newContext({ baseURL: API });

  for (const [rol, credenciales] of Object.entries(USUARIOS)) {
    const respuesta = await api.post('/api/auth/login', { data: credenciales });
    if (!respuesta.ok()) {
      throw new Error(
        `No se pudo iniciar sesión como ${rol}: ${respuesta.status()} ${await respuesta.text()}`,
      );
    }
    const datos = await respuesta.json();
    const sesion = {
      usuario: datos.usuario,
      token: datos.token,
      permisos: datos.permisos ?? [],
      expiraEn: datos.expiraEn,
    };
    const estado = {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [{ name: 'llamma.session.v1', value: JSON.stringify(sesion) }],
        },
      ],
    };
    fs.writeFileSync(path.join('e2e/.auth', `${rol}.json`), JSON.stringify(estado));
  }

  await api.dispose();
}
