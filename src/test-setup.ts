/**
 * Ajustes comunes del entorno de pruebas.
 *
 * Node 26 expone `localStorage` y `sessionStorage` experimentales que devuelven
 * `undefined` sin `--localstorage-file`. Vitest copia los globales del DOM solo
 * si no existen ya, así que esas sombras tapan las versiones de jsdom. Aquí se
 * vuelven a enlazar con la ventana real de jsdom para que `AuthService` pueda
 * probarse igual que en el navegador.
 */
const dom = (globalThis as { jsdom?: { window?: Window } }).jsdom?.window;

if (dom) {
  for (const clave of ['localStorage', 'sessionStorage'] as const) {
    const almacen = dom[clave];
    if (!almacen) continue;
    Object.defineProperty(globalThis, clave, {
      get: () => almacen,
      configurable: true,
    });
  }
}
