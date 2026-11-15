import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';

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

  readonly form = this.fb.nonNullable.group({
    correo: ['ana@llamma.mx', [Validators.required, Validators.email]],
    password: ['llamma2026', [Validators.required, Validators.minLength(6)]],
    recordarme: [true],
  });

  entrar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo, password } = this.form.getRawValue();

    this.auth
      .login(correo.trim().toLowerCase(), password)
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

  usarDemo(correo: string): void {
    this.form.patchValue({ correo, password: 'llamma2026' });
    this.entrar();
  }

  alternarPassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }
}
