import { test as base } from '@playwright/test';
import path from 'node:path';

export type Rol = 'admin' | 'vendedor' | 'marketing' | 'anonimo';

/**
 * `storageState` se genera en `global-setup.ts` con la clave real de sesión
 * (`llamma.session.v1`), no con un token suelto.
 */
export const test = base.extend<{ rol: Rol }>({
  rol: ['anonimo', { option: true }],
  storageState: async ({ rol }, use) => {
    await use(rol === 'anonimo' ? undefined : path.join('e2e/.auth', `${rol}.json`));
  },
});

export { expect } from '@playwright/test';
