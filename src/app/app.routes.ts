import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Llamma | Imprenta y transformación de productos',
    loadComponent: () => import('./llamma/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    title: 'Llamma | Iniciar sesión',
    loadComponent: () => import('./llamma/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    title: 'Llamma | Dashboard',
    loadComponent: () =>
      import('./llamma/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'captura',
    title: 'Llamma | Captura de pedidos',
    loadComponent: () =>
      import('./llamma/captura/captura.component').then((m) => m.CapturaComponent),
  },
  {
    path: 'detalle',
    title: 'Llamma | Detalle de órdenes',
    loadComponent: () =>
      import('./llamma/detalle/detalle.component').then((m) => m.DetalleComponent),
  },
  {
    path: 'consultas',
    title: 'Llamma | Consultas',
    loadComponent: () =>
      import('./llamma/consultas/consultas.component').then((m) => m.ConsultasComponent),
  },
  {
    path: 'productos',
    title: 'Llamma | Productos',
    loadComponent: () =>
      import('./llamma/productos/productos.component').then((m) => m.ProductosComponent),
  },
  {
    path: 'inventario',
    title: 'Llamma | Inventario',
    loadComponent: () =>
      import('./llamma/inventario/inventario.component').then((m) => m.InventarioComponent),
  },
  {
    path: 'abastecimiento',
    title: 'Llamma | Abastecimiento',
    loadComponent: () =>
      import('./llamma/abastecimiento/abastecimiento.component').then(
        (m) => m.AbastecimientoComponent,
      ),
  },
  {
    path: 'produccion',
    title: 'Llamma | Producción',
    loadComponent: () =>
      import('./llamma/produccion/produccion.component').then((m) => m.ProduccionComponent),
  },
  {
    path: 'clientes',
    title: 'Llamma | Clientes',
    loadComponent: () =>
      import('./llamma/clientes/clientes.component').then((m) => m.ClientesComponent),
  },
  {
    path: 'marketing',
    title: 'Llamma | Marketing',
    loadComponent: () =>
      import('./llamma/marketing/marketing.component').then((m) => m.MarketingComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
