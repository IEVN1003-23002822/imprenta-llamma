import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { RolApi, RolUsuario, Usuario } from '../../core/models/llamma.models';
import { LlammaService } from '../../core/services/llamma.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent implements OnInit {
  private readonly service = inject(LlammaService);
  private readonly ui = inject(UiService);
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly usuarios = signal<Usuario[]>([]);
  readonly roles = signal<RolApi[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly resumen = computed(() => {
    const lista = this.usuarios();
    return {
      total: lista.length,
      activos: lista.filter((usuario) => usuario.activo).length,
      admins: lista.filter((usuario) => usuario.rol === 'admin').length,
    };
  });

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rol: ['ventas' as RolUsuario, [Validators.required]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({
      usuarios: this.service.listarUsuarios(),
      roles: this.service.listarRoles(),
    })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: ({ usuarios, roles }) => {
          this.usuarios.set(usuarios.items);
          this.roles.set(roles.items);
        },
        error: (respuesta: HttpErrorResponse) => {
          this.error.set(
            this.ui.mensajeDeError(respuesta, 'No pudimos cargar el equipo de Llamma.'),
          );
        },
      });
  }

  guardar(): void {
    if (this.guardando()) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Revisa los campos marcados: nombre, correo y contraseña de 8 caracteres.');
      this.enfocarPrimerError();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    const valores = this.formulario.getRawValue();

    this.service
      .crearUsuario({
        nombre: valores.nombre.trim(),
        correo: valores.correo.trim().toLowerCase(),
        password: valores.password,
        rol: valores.rol,
      })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (usuario) => {
          this.ui.exito(`Usuario ${usuario.nombre} creado.`);
          this.formulario.reset({ nombre: '', correo: '', password: '', rol: 'ventas' });
          this.cargar();
        },
        error: (respuesta: HttpErrorResponse) => {
          const mensaje =
            respuesta.status === 409
              ? 'Ya existe un usuario con ese correo.'
              : this.ui.mensajeDeError(respuesta, 'No pudimos crear el usuario.');
          this.error.set(mensaje);
          this.ui.error(mensaje);
        },
      });
  }

  etiquetaRol(valor: string | null | undefined): string {
    if (!valor) return 'Sin rol';
    const rol = this.roles().find((item) => item.nombre === valor);
    return rol?.descripcion || valor;
  }

  claseRol(valor: string | null | undefined): string {
    if (valor === 'admin') {
      return 'bg-[rgba(var(--llamma-magenta-rgb),0.12)] text-[var(--llamma-magenta)]';
    }
    if (valor === 'ventas') {
      return 'bg-[rgba(var(--llamma-cyan-rgb),0.12)] text-[var(--llamma-cyan-deep)]';
    }
    return 'bg-[rgba(26,26,26,0.06)] text-[var(--llamma-muted)]';
  }

  iniciales(nombre: string | null | undefined): string {
    return (nombre ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  }

  fecha(valor: string | null | undefined): string {
    if (!valor) return 'Sin acceso registrado';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Sin acceso registrado';
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fecha);
  }

  fuerzaPassword(): { nivel: number; etiqueta: string; clase: string } {
    const valor = this.formulario.controls.password.value ?? '';
    let puntos = 0;
    if (valor.length >= 8) puntos += 1;
    if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos += 1;
    if (/\d/.test(valor)) puntos += 1;
    if (/[^A-Za-z0-9]/.test(valor)) puntos += 1;

    const nivel = Math.min(puntos, 4);
    const etiquetas = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte'];
    const clases = ['bg-[#b42318]', 'bg-[#d97706]', 'bg-[#eab308]', 'bg-[#15803d]', 'bg-[#166534]'];
    return { nivel, etiqueta: etiquetas[nivel], clase: clases[nivel] };
  }

  private enfocarPrimerError(): void {
    const primero = (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'input.ng-invalid, select.ng-invalid',
    );
    primero?.focus();
  }
}
