import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { SITE_INFO } from '../config/site-info';

const DESCRIPCION_POR_DEFECTO =
  'Llamma: imprenta, gran formato, línea textil, artículos promocionales y papelería creativa.';

/** Rutas del ERP y acceso que nunca deben indexarse. */
const RUTAS_PRIVADAS = new Set([
  'login',
  'dashboard',
  'solicitudes',
  'captura',
  'detalle',
  'consultas',
  'inventario',
  'abastecimiento',
  'produccion',
  'clientes',
  'marketing',
]);

interface SeoRuta {
  descripcion?: string;
  noindex?: boolean;
}

/**
 * Mantiene el título, la descripción, la canonical y las etiquetas sociales
 * de cada ruta pública. El ERP y el login se marcan como `noindex`.
 *
 * La ruta declara su descripción en `data.seo`; aquí solo se aplica.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  // PNG para las tarjetas sociales: WhatsApp y LinkedIn no siempre leen WebP.
  private readonly imagen = 'assets/images/logo-llamma.png';

  constructor() {
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd))
      .subscribe(() => this.actualizar());

    this.actualizar();
    this.inyectarDatosEstructurados();
  }

  private actualizar(): void {
    const ruta = this.rutaActiva();
    const seo = (ruta.data?.['seo'] ?? {}) as SeoRuta;
    const descripcion = seo.descripcion ?? DESCRIPCION_POR_DEFECTO;
    const titulo = this.title.getTitle();
    const url = this.urlCanonica();
    const imagen = this.urlAbsoluta(this.imagen);
    const privada = RUTAS_PRIVADAS.has(this.router.url.split('?')[0].split('/')[1] ?? '');
    const robots = seo.noindex || privada ? 'noindex, nofollow' : 'index, follow';

    this.meta.updateTag({ name: 'description', content: descripcion });
    this.meta.updateTag({ name: 'robots', content: robots });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_INFO.nombre });
    this.meta.updateTag({ property: 'og:locale', content: 'es_MX' });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descripcion });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: imagen });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: descripcion });
    this.meta.updateTag({ name: 'twitter:image', content: imagen });

    let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
  }

  private rutaActiva(): ActivatedRouteSnapshot {
    let ruta = this.router.routerState.snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    return ruta;
  }

  private urlCanonica(): string {
    const ruta = this.router.url.split('?')[0].split('#')[0] || '/';
    return this.urlAbsoluta(ruta);
  }

  private urlAbsoluta(ruta: string): string {
    return new URL(ruta, this.document.baseURI).toString();
  }

  private inyectarDatosEstructurados(): void {
    const datos = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: SITE_INFO.nombre,
      description: SITE_INFO.descripcion,
      email: SITE_INFO.correo,
      url: this.urlAbsoluta('/'),
      image: this.urlAbsoluta(this.imagen),
      logo: this.urlAbsoluta(this.imagen),
      knowsLanguage: 'es-MX',
      areaServed: { '@type': 'Country', name: 'México' },
    });

    const existente = this.document.getElementById('llamma-datos-estructurados');
    if (existente) {
      existente.textContent = datos;
      return;
    }

    const guion = this.document.createElement('script');
    guion.type = 'application/ld+json';
    guion.id = 'llamma-datos-estructurados';
    guion.textContent = datos;
    this.document.head.appendChild(guion);
  }
}
