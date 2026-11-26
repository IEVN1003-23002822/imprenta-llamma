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
  /** Errores del formulario, junto a los campos (independientes de la carga). */
  readonly errorFormulario = signal<string | null>(null);
  readonly usuarioEditandoId = signal<Usuario['id'] | null>(null);
  readonly modoEdicion = computed(() => this.usuarioEditandoId() !== null);

  // Límites alineados con las columnas de la API (`usuarios`).
  readonly maxNombre = 120;
  readonly maxCorreo = 160;
  readonly maxPassword = 128;

  readonly resumen = computed(() => {
    const lista = this.usuarios();
    return {
      total: lista.length,
      activos: lista.filter((usuario) => usuario.activo).length,
      admins: lista.filter((usuario) => usuario.rol === 'admin').length,
    };
  });

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
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

  editarUsuario(usuario: Usuario): void {
    if (this.guardando()) return;
    this.usuarioEditandoId.set(usuario.id);
    this.error.set(null);
    this.errorFormulario.set(null);
    this.formulario.setValue({
      nombre: usuario.nombre,
      correo: usuario.correo,
      password: '',
      rol: usuario.rol,
    });
    this.configurarPassword(false);
    setTimeout(() => this.desplazarAlFormulario());
  }

  cancelarEdicion(): void {
    this.usuarioEditandoId.set(null);
    this.error.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset({ nombre: '', correo: '', password: '', rol: 'ventas' });
    this.configurarPassword(true);
  }

  guardar(): void {
    if (this.guardando()) return;

    // Normaliza antes de validar: un nombre de solo espacios no debe viajar a la API.
    const valores = this.formulario.getRawValue();
    const nombre = valores.nombre.trim();
    const correo = valores.correo.trim().toLowerCase();
    if (nombre !== valores.nombre || correo !== valores.correo) {
      this.formulario.patchValue({ nombre, correo });
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.errorFormulario.set(
        this.modoEdicion()
          ? 'Revisa los campos marcados: nombre, correo y, si la cambias, una contraseña válida.'
          : 'Revisa los campos marcados: nombre, correo y contraseña de 8 caracteres o más.',
      );
      this.enfocarPrimerError();
      return;
    }

    this.guardando.set(true);
    this.errorFormulario.set(null);
    const editandoId = this.usuarioEditandoId();

    const peticion =
      editandoId !== null
        ? this.service.actualizarUsuario(editandoId, {
            nombre,
            correo,
            rol: valores.rol,
            password: valores.password || undefined,
          })
        : this.service.crearUsuario({
            nombre,
            correo,
            password: valores.password,
            rol: valores.rol,
          });

    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (usuario) => {
        this.ui.exito(
          editandoId !== null
            ? `Usuario ${usuario.nombre} actualizado.`
            : `Usuario ${usuario.nombre} creado.`,
        );
        this.cancelarEdicion();
        this.cargar();
      },
      error: (respuesta: HttpErrorResponse) => {
        const mensaje =
          respuesta.status === 409
            ? 'El correo ya está en uso.'
            : this.ui.mensajeDeError(
                respuesta,
                editandoId !== null
                  ? 'No pudimos actualizar el usuario.'
                  : 'No pudimos crear el usuario.',
              );
        this.errorFormulario.set(mensaje);
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

  mensajeNombre(): string {
    const control = this.formulario.controls.nombre;
    return control.hasError('maxlength')
      ? `Máximo ${this.maxNombre} caracteres.`
      : 'Indica al menos dos caracteres.';
  }

  mensajeCorreo(): string {
    const control = this.formulario.controls.correo;
    return control.hasError('maxlength')
      ? `Máximo ${this.maxCorreo} caracteres.`
      : 'Ingresa un correo válido.';
  }

  mensajePassword(): string {
    const control = this.formulario.controls.password;
    return control.hasError('maxlength')
      ? `Máximo ${this.maxPassword} caracteres.`
      : 'La contraseña debe tener al menos 8 caracteres.';
  }

  private configurarPassword(obligatoria: boolean): void {
    const control = this.formulario.controls.password;
    control.setValidators(
      obligatoria
        ? [Validators.required, Validators.minLength(8), Validators.maxLength(128)]
        : [Validators.minLength(8), Validators.maxLength(128)],
    );
    control.updateValueAndValidity();
  }

  private desplazarAlFormulario(): void {
    const raiz = this.host.nativeElement as HTMLElement;
    raiz
      .querySelector<HTMLElement>('#formularioUsuario')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    raiz.querySelector<HTMLInputElement>('#usuarioNombre')?.focus({ preventScroll: true });
  }

  private enfocarPrimerError(): void {
    const controles = [
      { id: 'usuarioNombre', valido: this.formulario.controls.nombre.valid },
      { id: 'usuarioCorreo', valido: this.formulario.controls.correo.valid },
      { id: 'usuarioPassword', valido: this.formulario.controls.password.valid },
      { id: 'usuarioRol', valido: this.formulario.controls.rol.valid },
    ];
    const primero = controles.find((control) => !control.valido) ?? controles[0];
    (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${primero.id}`)?.focus();
  }
}
