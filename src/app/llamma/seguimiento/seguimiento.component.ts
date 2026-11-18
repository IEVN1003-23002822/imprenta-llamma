import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { LlammaService } from '../llamma.service';
import {
  ESTADOS_SOLICITUD,
  EXTENSIONES_ARCHIVO,
  MAX_BYTES_ARCHIVO,
  badgeDe,
  etiquetaDe,
} from '../estados';
import { EstadoSolicitud, MensajeChat, SeguimientoSolicitud } from '../llamma.models';

@Component({
  selector: 'app-seguimiento',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './seguimiento.component.html',
  styleUrl: './seguimiento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeguimientoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LlammaService);
  private readonly route = inject(ActivatedRoute);

  readonly seguimiento = signal<SeguimientoSolicitud | null>(null);
  readonly buscando = signal(false);
  readonly errorSeguimiento = signal<string | null>(null);

  readonly mensajes = signal<MensajeChat[]>([]);
  readonly borrador = signal('');
  readonly adjuntoChat = signal<File | null>(null);
  readonly enviandoMensaje = signal(false);
  readonly errorChat = signal<string | null>(null);
  readonly descargandoAdjunto = signal<number | null>(null);
  private readonly hiloChat = viewChild<ElementRef<HTMLDivElement>>('hiloChat');

  readonly seguimientoForm = this.fb.nonNullable.group({
    folio: ['', [Validators.required]],
    correo: ['', [Validators.required, Validators.email]],
  });

  private ultimaConsulta = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const folio = params.get('folio') ?? '';
    const correo = params.get('correo') ?? '';
    if (folio || correo) {
      this.seguimientoForm.patchValue({ folio, correo });
    }
    if (folio && correo) {
      this.consultar(false);
    }
  }

  consultar(actualizarFoco = true): void {
    if (this.buscando()) return;

    if (this.seguimientoForm.invalid) {
      this.seguimientoForm.markAllAsTouched();
      this.errorSeguimiento.set(
        'Escribe el folio y el correo con el que registraste la solicitud.',
      );
      if (actualizarFoco) this.enfocarPrimerError();
      return;
    }

    const { folio, correo } = this.seguimientoForm.getRawValue();
    const folioLimpio = folio.trim().toUpperCase();
    const correoLimpio = correo.trim().toLowerCase();
    const clave = `${folioLimpio}|${correoLimpio}`;
    if (clave === this.ultimaConsulta) return;

    this.buscando.set(true);
    this.errorSeguimiento.set(null);
    this.seguimiento.set(null);
    this.mensajes.set([]);
    this.borrador.set('');
    this.adjuntoChat.set(null);
    this.errorChat.set(null);

    this.service
      .consultarSolicitud(folioLimpio, correoLimpio)
      .pipe(finalize(() => this.buscando.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.ultimaConsulta = clave;
          this.seguimiento.set(respuesta);
          this.mensajes.set(respuesta.mensajes ?? []);
          this.desplazarHilo();
          if (actualizarFoco) {
            document.getElementById('resultadoSeguimiento')?.focus();
          }
        },
        error: (respuesta: HttpErrorResponse) => {
          this.errorSeguimiento.set(
            respuesta.status === 404
              ? 'No encontramos una solicitud con ese folio y correo. Verifica los datos o escríbenos.'
              : 'No pudimos consultar la solicitud. Intenta de nuevo.',
          );
        },
      });
  }

  actualizarBorrador(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
  }

  seleccionarAdjunto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';

    if (!archivo) return;
    const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES_ARCHIVO.includes(extension)) {
      this.errorChat.set(`"${archivo.name}" no tiene un formato permitido.`);
      return;
    }
    if (archivo.size > MAX_BYTES_ARCHIVO) {
      this.errorChat.set(`"${archivo.name}" supera el límite de 25 MB.`);
      return;
    }
    this.adjuntoChat.set(archivo);
    this.errorChat.set(null);
  }

  quitarAdjuntoChat(): void {
    this.adjuntoChat.set(null);
  }

  enviarMensaje(): void {
    const solicitud = this.seguimiento();
    if (!solicitud || this.enviandoMensaje()) return;

    const mensaje = this.borrador().trim();
    const archivo = this.adjuntoChat();
    if (!mensaje && !archivo) {
      this.errorChat.set('Escribe un mensaje o adjunta un archivo de referencia.');
      return;
    }

    const { correo } = this.seguimientoForm.getRawValue();
    this.enviandoMensaje.set(true);
    this.errorChat.set(null);

    this.service
      .enviarMensajePublico(solicitud.folio, correo.trim().toLowerCase(), mensaje, archivo)
      .pipe(finalize(() => this.enviandoMensaje.set(false)))
      .subscribe({
        next: (respuesta) => {
          this.mensajes.update((actuales) => [...actuales, respuesta.mensajeChat]);
          this.borrador.set('');
          this.adjuntoChat.set(null);
          this.desplazarHilo();
        },
        error: (respuesta: HttpErrorResponse) => {
          this.errorChat.set(
            respuesta.status === 404
              ? 'Tu folio y correo ya no coinciden. Vuelve a consultar la solicitud.'
              : respuesta.error?.error || 'No pudimos enviar tu mensaje. Intenta de nuevo.',
          );
        },
      });
  }

  refrescarChat(): void {
    const solicitud = this.seguimiento();
    if (!solicitud) return;
    const { correo } = this.seguimientoForm.getRawValue();

    this.service.listarMensajesPublicos(solicitud.folio, correo.trim().toLowerCase()).subscribe({
      next: (respuesta) => {
        this.mensajes.set(respuesta.items);
        this.desplazarHilo();
      },
      error: () => this.errorChat.set('No pudimos actualizar la conversación.'),
    });
  }

  descargarAdjuntoChat(mensaje: MensajeChat): void {
    const solicitud = this.seguimiento();
    if (!solicitud || !mensaje.adjunto) return;

    const { correo } = this.seguimientoForm.getRawValue();
    this.descargandoAdjunto.set(mensaje.id);
    this.service
      .descargarAdjuntoPublico(solicitud.folio, correo.trim().toLowerCase(), mensaje.id)
      .pipe(finalize(() => this.descargandoAdjunto.set(null)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = mensaje.adjunto?.nombre || 'adjunto';
          enlace.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.errorChat.set('No pudimos descargar el archivo adjunto.'),
      });
  }

  fechaHoraChat(valor: string | null | undefined): string {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  tamanoChat(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }

  fecha(valor: string | null | undefined): string {
    if (!valor) return 'Por confirmar';
    const fecha = new Date(`${valor.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  etiquetaEstado(estado: EstadoSolicitud): string {
    return etiquetaDe(ESTADOS_SOLICITUD, estado);
  }

  claseEstado(estado: EstadoSolicitud): string {
    return badgeDe(ESTADOS_SOLICITUD, estado);
  }

  private enfocarPrimerError(): void {
    const primero = this.seguimientoForm.controls.folio.invalid ? 'segFolio' : 'segCorreo';
    const campo = document.getElementById(primero);
    campo?.focus();
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private desplazarHilo(): void {
    setTimeout(() => {
      const contenedor = this.hiloChat()?.nativeElement;
      if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
    });
  }
}
