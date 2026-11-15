import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { AuthSession, RespuestaLogin, RolUsuario } from './llamma.models';

const STORAGE_KEY = 'llamma.session.v1';

/**
 * Estado de sesión basado en signals.
 *
 * El token se persiste en localStorage para sobrevivir recargas y se envía
 * automáticamente mediante el interceptor HTTP.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/auth';

  private readonly _sesion = signal<AuthSession | null>(this.leerSesion());
  readonly sesion = this._sesion.asReadonly();

  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly permisos = computed(() => this._sesion()?.permisos ?? []);
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'admin');
  readonly nombre = computed(() => this.usuario()?.nombre ?? '');
  readonly rol = computed(() => this.usuario()?.rol ?? null);

  get token(): string | null {
    return this._sesion()?.token ?? null;
  }

  login(correo: string, password: string): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${this.apiUrl}/login`, { correo, password })
      .pipe(
        tap((respuesta) => {
          this.guardarSesion({
            usuario: respuesta.usuario,
            token: respuesta.token,
            permisos: respuesta.permisos,
            expiraEn: respuesta.expiraEn,
          });
        }),
      );
  }

  logout(): void {
    const token = this.token;
    if (token) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }
    this.limpiarSesion();
  }

  tieneRol(...roles: RolUsuario[]): boolean {
    const actual = this.usuario()?.rol;
    return !!actual && roles.includes(actual);
  }

  tienePermiso(clave: string): boolean {
    return this.permisos().includes(clave);
  }

  tieneAlgunPermiso(...claves: string[]): boolean {
    return claves.some((clave) => this.tienePermiso(clave));
  }

  guardarSesion(sesion: AuthSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
    } catch {
      /* almacenamiento no disponible */
    }
    this._sesion.set(sesion);
  }

  limpiarSesion(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
    this._sesion.set(null);
  }

  private leerSesion(): AuthSession | null {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (!bruto) return null;
      const sesion = JSON.parse(bruto) as AuthSession;
      if (!sesion?.token || !sesion?.usuario) return null;
      if (sesion.expiraEn) {
        const expira = new Date(sesion.expiraEn).getTime();
        if (!Number.isNaN(expira) && expira <= Date.now()) {
          localStorage.removeItem(STORAGE_KEY);
          return null;
        }
      }
      return sesion;
    } catch {
      return null;
    }
  }
}
