import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-marketing',
  imports: [RouterLink],
  templateUrl: './marketing.component.html',
  styleUrl: './marketing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingComponent {}
