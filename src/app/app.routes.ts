import { Routes } from '@angular/router';

import { authGuard, publicOnlyGuard, roleGuard } from './core/guards/auth.guard';

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
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
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
      import('./features/productos/productos.component').then((m) => m.ProductosComponent),
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
      import('./features/cotizar/cotizar.component').then((m) => m.CotizarComponent),
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
      import('./features/seguimiento/seguimiento.component').then((m) => m.SeguimientoComponent),
  },
  {
    path: 'login',
    title: 'Llamma | Acceso del equipo',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
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
      import('./features/aviso-privacidad/aviso-privacidad.component').then(
        (m) => m.AvisoPrivacidadComponent,
      ),
  },

  /* ----------------------------- ERP interno ---------------------------- */
  {
    path: 'dashboard',
    title: 'Llamma | Dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'solicitudes',
    title: 'Llamma | Bandeja de solicitudes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas'] },
    loadComponent: () =>
      import('./features/solicitudes/solicitudes.component').then((m) => m.SolicitudesComponent),
  },
  {
    path: 'captura',
    title: 'Llamma | Cotizador',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas'] },
    loadComponent: () =>
      import('./features/captura/captura.component').then((m) => m.CapturaComponent),
  },
  {
    path: 'detalle',
    title: 'Llamma | Detalle de órdenes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'produccion'] },
    loadComponent: () =>
      import('./features/detalle/detalle.component').then((m) => m.DetalleComponent),
  },
  {
    path: 'consultas',
    title: 'Llamma | Consultas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/consultas/consultas.component').then((m) => m.ConsultasComponent),
  },
  {
    path: 'inventario',
    title: 'Llamma | Inventario',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'inventario', 'produccion'] },
    loadComponent: () =>
      import('./features/inventario/inventario.component').then((m) => m.InventarioComponent),
  },
  {
    path: 'abastecimiento',
    title: 'Llamma | Abastecimiento',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'inventario'] },
    loadComponent: () =>
      import('./features/abastecimiento/abastecimiento.component').then(
        (m) => m.AbastecimientoComponent,
      ),
  },
  {
    path: 'produccion',
    title: 'Llamma | Producción',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'inventario', 'produccion'] },
    loadComponent: () =>
      import('./features/produccion/produccion.component').then((m) => m.ProduccionComponent),
  },
  {
    path: 'clientes',
    title: 'Llamma | Clientes',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'ventas', 'marketing'] },
    loadComponent: () =>
      import('./features/clientes/clientes.component').then((m) => m.ClientesComponent),
  },
  {
    path: 'usuarios',
    title: 'Llamma | Usuarios',
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['admin'],
      seo: {
        descripcion: 'Administración de usuarios internos y roles de acceso al panel de Llamma.',
        noindex: true,
      },
    },
    loadComponent: () =>
      import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
  },
  {
    path: 'marketing',
    title: 'Llamma | Marketing',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'marketing'] },
    loadComponent: () =>
      import('./features/marketing/marketing.component').then((m) => m.MarketingComponent),
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
      import('./features/no-encontrado/no-encontrado.component').then(
        (m) => m.NoEncontradoComponent,
      ),
  },
];
