import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrado',
  imports: [FormsModule, RouterLink],
  templateUrl: './no-encontrado.component.html',
  styleUrl: './no-encontrado.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontradoComponent {
  private readonly router = inject(Router);

  readonly texto = signal('');

  buscar(): void {
    const termino = this.texto().trim();
    this.router.navigate(['/productos'], {
      queryParams: termino ? { q: termino } : {},
    });
  }
}
