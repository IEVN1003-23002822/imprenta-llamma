import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);
  readonly ayudaAcceso = signal(false);

  readonly form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    recordarme: [false],
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('expirada') === '1') {
      this.error.set('Tu sesión expiró. Vuelve a iniciar sesión para continuar.');
    }
  }

  entrar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo, password, recordarme } = this.form.getRawValue();

    this.auth
      .login(correo.trim().toLowerCase(), password, recordarme)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: () => {
          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          this.router.navigateByUrl(redirect || '/dashboard');
        },
        error: (respuesta: HttpErrorResponse) => {
          const mensaje =
            respuesta.status === 0
              ? 'No pudimos conectar con el servidor. Verifica que la API esté en línea.'
              : respuesta.error?.error || 'Credenciales incorrectas. Intenta de nuevo.';
          this.error.set(mensaje);
        },
      });
  }

  alternarPassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  alternarAyuda(): void {
    this.ayudaAcceso.update((valor) => !valor);
  }

  private enfocarPrimerError(): void {
    const campo = this.form.controls.correo.invalid ? 'authEmail' : 'authPassword';
    const elemento = document.getElementById(campo);
    elemento?.focus();
    elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
