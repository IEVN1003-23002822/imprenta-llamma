import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

/**
 * Servicio HTTP base para la comunicación con Flask_Llamma_API.
 *
 * Los métodos de acceso a datos (clientes, materias primas, productos,
 * pedidos, recetas y movimientos) se implementarán en una fase posterior.
 */
@Injectable({ providedIn: 'root' })
export class LlammaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api';
}
