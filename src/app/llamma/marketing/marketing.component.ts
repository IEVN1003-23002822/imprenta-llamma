import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-marketing',
  templateUrl: './marketing.component.html',
  styleUrl: './marketing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingComponent {}