import { Routes } from '@angular/router';

import { authGuard, publicOnlyGuard, roleGuard } from './llamma/auth.guard';

export const routes: Routes = [
  /* --------------------------- Portal público --------------------------- */
  {
    path: '',
    title: 'Llamma | Imprenta y transformación de productos',
    data: {
      seo: {
        descripcion:
          'Imprenta y estudio de producción en México: gran formato, sublimación textil, promocionales y papelería creativa. Cotiza tu proyecto en línea.',
      },
    },
    loadComponent: () => import('./llamma/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'productos',
    title: 'Llamma | Catálogo',
    data: {
      seo: {
        descripcion:
          'Catálogo de productos Llamma: roll-ups, lonas, playeras, tote bags, tazas, stickers y papelería con precios de referencia.',
      },
    },
    loadComponent: () =>
      import('./llamma/productos/productos.component').then((m) => m.ProductosComponent),
  },
  {
    path: 'cotizar',
    title: 'Llamma | Solicitar cotización',
    data: {
      seo: {
        descripcion:
          'Solicita tu cotización de imprenta: elige productos, adjunta archivos y recibe una propuesta con materiales, acabados y tiempos.',
      },
    },
    loadComponent: () =>
      import('./llamma/cotizar/cotizar.component').then((m) => m.CotizarComponent),
  },
  {
    path: 'seguimiento',
    title: 'Llamma | Seguimiento de solicitud',
    data: {
      seo: {
        descripcion:
          'Consulta el estatus de tu solicitud con folio y correo, revisa partidas, descarga adjuntos y conversa con el equipo de Llamma.',
      },
    },
    loadComponent: () =>
      import('./llamma/seguimiento/seguimiento.component').then((m) => m.SeguimientoComponent),
  },
  {
    path: 'login',
    title: 'Llamma | Acceso del equipo',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./llamma/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'aviso-privacidad',
    title: 'Llamma | Aviso de privacidad',
    data: {
      seo: {
        descripcion:
          'Aviso de privacidad de Llamma: datos personales, finalidades, derechos ARCO y contacto del responsable.',
      },
    },
    loadComponent: () =>
      import('./llamma/aviso-privacidad/aviso-privacidad.component').then(
        (m) => m.AvisoPrivacidadComponent,
      ),
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
    title: 'Llamma | Página no encontrada',
    data: {
      seo: {
        descripcion:
          'La página que buscas no existe. Vuelve al inicio o explora el catálogo de Llamma.',
        noindex: true,
      },
    },
    loadComponent: () =>
      import('./llamma/no-encontrado/no-encontrado.component').then((m) => m.NoEncontradoComponent),
  },
];
