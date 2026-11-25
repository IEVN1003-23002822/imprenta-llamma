import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { AuthSession, RespuestaLogin, RolUsuario } from '../models/llamma.models';

const STORAGE_KEY = 'llamma.session.v1';
const REVISION_MS = 30_000;

/**
 * Estado de sesión basado en signals.
 *
 * «Recordarme» guarda la sesión en localStorage (sobrevive al cierre del
 * navegador); sin él se usa sessionStorage. La expiración se revisa al cargar
 * y cada 30 segundos, no solo cuando la API responde 401.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = '/api/auth';

  /** Marca de tiempo reactiva que invalidará la sesión al vencer. */
  private readonly ahora = signal(Date.now());
  private readonly _sesion = signal<AuthSession | null>(this.leerSesion());
  private ultimaRedireccion = 0;

  readonly sesion = this._sesion.asReadonly();

  readonly usuario = computed(() => this._sesion()?.usuario ?? null);
  readonly permisos = computed(() => this._sesion()?.permisos ?? []);
  readonly autenticado = computed(() => this.vigente(this._sesion()));
  readonly esAdmin = computed(() => this.usuario()?.rol === 'admin');
  readonly nombre = computed(() => this.usuario()?.nombre ?? '');
  readonly rol = computed(() => this.usuario()?.rol ?? null);

  constructor() {
    const reloj = setInterval(() => {
      if (!this._sesion()) return;
      this.ahora.set(Date.now());
      if (!this.vigente(this._sesion())) {
        this.expirarSesion();
      }
    }, REVISION_MS);

    this.destroyRef.onDestroy(() => clearInterval(reloj));
  }

  get token(): string | null {
    return this._sesion()?.token ?? null;
  }

  login(correo: string, password: string, recordar = true): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>(`${this.apiUrl}/login`, { correo, password }).pipe(
      tap((respuesta) => {
        this.guardarSesion(
          {
            usuario: respuesta.usuario,
            token: respuesta.token,
            permisos: respuesta.permisos,
            expiraEn: respuesta.expiraEn,
          },
          recordar,
        );
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

  /**
   * Cierra la sesión local cuando la API responde 401 o vence el token.
   * Devuelve `true` si había una sesión que cerrar (evita avisos duplicados).
   */
  expirarSesion(): boolean {
    if (!this._sesion()) return false;

    this.limpiarSesion();

    const ahora = Date.now();
    if (ahora - this.ultimaRedireccion < 1500) return true;
    this.ultimaRedireccion = ahora;

    // Durante el arranque el router todavía puede estar en «/»; en ese caso la
    // URL real del navegador es la que conserva la página que el usuario abrió.
    const actual =
      this.router.url !== '/'
        ? this.router.url
        : `${window.location.pathname}${window.location.search}`;
    if (actual.startsWith('/login')) return true;

    void this.router.navigate(['/login'], {
      queryParams: {
        expirada: '1',
        redirect: actual.startsWith('/') ? actual : null,
      },
    });
    return true;
  }

  tieneRol(...roles: RolUsuario[]): boolean {
    const actual = this.usuario()?.rol;
    return !!actual && roles.includes(actual);
  }

  /** Permisos de edición por módulo (fuente única para guards y botones). */
  puedeEditarVentas(): boolean {
    return this.tieneRol('admin', 'ventas');
  }

  puedeEditarInventario(): boolean {
    return this.tieneRol('admin', 'produccion', 'inventario');
  }

  puedeEditarClientes(): boolean {
    return this.tieneRol('admin', 'ventas');
  }

  puedeEditarProduccion(): boolean {
    return this.tieneRol('admin', 'produccion');
  }

  tienePermiso(clave: string): boolean {
    return this.permisos().includes(clave);
  }

  tieneAlgunPermiso(...claves: string[]): boolean {
    return claves.some((clave) => this.tienePermiso(clave));
  }

  guardarSesion(sesion: AuthSession, recordar = true): void {
    this.borrarAlmacenadas();
    try {
      const destino = recordar ? localStorage : sessionStorage;
      destino.setItem(STORAGE_KEY, JSON.stringify(sesion));
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria */
    }
    this._sesion.set(sesion);
  }

  limpiarSesion(): void {
    this.borrarAlmacenadas();
    this._sesion.set(null);
  }

  /** Una sesión sin `expiraEn` se considera válida mientras exista. */
  private vigente(sesion: AuthSession | null): boolean {
    if (!sesion) return false;
    if (!sesion.expiraEn) return true;

    const expira = new Date(sesion.expiraEn).getTime();
    return Number.isNaN(expira) || expira > this.ahora();
  }

  private borrarAlmacenadas(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private leerSesion(): AuthSession | null {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (!bruto) return null;

      const sesion = JSON.parse(bruto) as AuthSession;
      if (!sesion?.token || !sesion?.usuario) return null;

      if (sesion.expiraEn) {
        const expira = new Date(sesion.expiraEn).getTime();
        if (!Number.isNaN(expira) && expira <= Date.now()) {
          this.borrarAlmacenadas();
          return null;
        }
      }
      return sesion;
    } catch {
      return null;
    }
  }
}
