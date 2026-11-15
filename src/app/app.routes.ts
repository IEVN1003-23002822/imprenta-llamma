import { Routes } from '@angular/router';

import { authGuard, publicOnlyGuard, roleGuard } from './llamma/auth.guard';

export const routes: Routes = [
  /* --------------------------- Portal público --------------------------- */
  {
    path: '',
    title: 'Llamma | Imprenta y transformación de productos',
    loadComponent: () => import('./llamma/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'productos',
    title: 'Llamma | Catálogo',
    loadComponent: () =>
      import('./llamma/productos/productos.component').then((m) => m.ProductosComponent),
  },
  {
    path: 'cotizar',
    title: 'Llamma | Solicitar cotización',
    loadComponent: () =>
      import('./llamma/cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  {
    path: 'login',
    title: 'Llamma | Acceso del equipo',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./llamma/login/login.component').then((m) => m.LoginComponent),
  },

  /* ----------------------------- ERP interno ---------------------------- */
  {
    path: 'dashboard',
    title: 'Llamma | Dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./llamma/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'solicitudes',
    title: 'Llamma | Bandeja de solicitudes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas'] },
    loadComponent: () =>
      import('./llamma/solicitudes/solicitudes.component').then((m) => m.SolicitudesComponent),
  },
  {
    path: 'captura',
    title: 'Llamma | Cotizador',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas'] },
    loadComponent: () =>
      import('./llamma/captura/captura.component').then((m) => m.CapturaComponent),
  },
  {
    path: 'detalle',
    title: 'Llamma | Detalle de órdenes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'produccion'] },
    loadComponent: () =>
      import('./llamma/detalle/detalle.component').then((m) => m.DetalleComponent),
  },
  {
    path: 'consultas',
    title: 'Llamma | Consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./llamma/consultas/consultas.component').then((m) => m.ConsultasComponent),
  },
  {
    path: 'inventario',
    title: 'Llamma | Inventario',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'inventario', 'produccion'] },
    loadComponent: () =>
      import('./llamma/inventario/inventario.component').then((m) => m.InventarioComponent),
  },
  {
    path: 'abastecimiento',
    title: 'Llamma | Abastecimiento',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'inventario'] },
    loadComponent: () =>
      import('./llamma/abastecimiento/abastecimiento.component').then(
        (m) => m.AbastecimientoComponent,
      ),
  },
  {
    path: 'produccion',
    title: 'Llamma | Producción',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'produccion'] },
    loadComponent: () =>
      import('./llamma/produccion/produccion.component').then((m) => m.ProduccionComponent),
  },
  {
    path: 'clientes',
    title: 'Llamma | Clientes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'marketing'] },
    loadComponent: () =>
      import('./llamma/clientes/clientes.component').then((m) => m.ClientesComponent),
  },
  {
    path: 'marketing',
    title: 'Llamma | Marketing',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'marketing'] },
    loadComponent: () =>
      import('./llamma/marketing/marketing.component').then((m) => m.MarketingComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
