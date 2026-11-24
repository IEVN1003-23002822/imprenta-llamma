import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * `@angular/build` entrega a Vitest los archivos de prueba como rutas absolutas
 * y, en Windows, `tinyglobby` no resuelve patrones absolutos, así que Vitest
 * termina con «No test files found». Convertirlas a rutas relativas a la raíz
 * del proyecto conserva el mismo conjunto de pruebas y funciona en todos los
 * sistemas operativos.
 */
function relativizarIncluidos(proyecto: { root?: string; test?: { include?: string[] } }, raiz: string) {
  const incluye = proyecto.test?.include;
  if (!incluye?.length) return;

  const base = proyecto.root ?? raiz;
  proyecto.test!.include = incluye.map((patron) =>
    path.isAbsolute(patron) ? path.relative(base, patron).split(path.sep).join('/') : patron,
  );
}

export default defineConfig({
  plugins: [
    {
      name: 'llamma:incluir-pruebas-relativas',
      enforce: 'post',
      configResolved(config) {
        for (const proyecto of config.test?.projects ?? []) {
          relativizarIncluidos(proyecto, config.root);
        }
      },
    },
  ],
});
