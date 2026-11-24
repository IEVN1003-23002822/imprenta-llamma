import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timeout, timer } from 'rxjs';

const ESPERA_MAXIMA_MS = 20_000;
const REINTENTOS_GET = 1;

/**
 * Da una salida clara a los fallos de red en la API:
 *
 * - Corta cualquier petición que tarde más de 20 s.
 * - Reintenta una vez los `GET` ante fallos de red (`status 0`) o respuestas
 *   5xx, tras una espera breve. Los métodos que escriben no se reintentan
 *   para no duplicar altas, pagos o movimientos de inventario.
 */
export const resilienciaInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    timeout(ESPERA_MAXIMA_MS),
    retry({
      count: req.method === 'GET' ? REINTENTOS_GET : 0,
      delay: (error: HttpErrorResponse, intento: number) => {
        const recuperable = error.status === 0 || error.status >= 500;
        if (!recuperable) return throwError(() => error);
        return timer(500 * intento);
      },
    }),
  );
};
