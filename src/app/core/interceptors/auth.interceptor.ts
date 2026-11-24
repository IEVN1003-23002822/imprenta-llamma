import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { UiService } from '../services/ui.service';

/**
 * Adjunta el token de sesión a las llamadas internas de la API y centraliza
 * el 401: cierra la sesión y manda al login con un mensaje claro.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const ui = inject(UiService);

  // Se compara solo la ruta: una URL interna puede llevar `/public/` en sus
  // parámetros sin ser un endpoint público.
  const [ruta] = req.url.split(/[?#]/);
  const esPublica =
    ruta === '/api/public' || ruta.startsWith('/api/public/') || ruta === '/api/auth/login';
  const token = auth.token;
  const conToken = !esPublica && !!token;

  const peticion = conToken ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && conToken) {
        // Evita que los componentes muestren además su propio toast de error.
        ui.silenciarErrores();
        auth.expirarSesion();
      }
      return throwError(() => error);
    }),
  );
};
