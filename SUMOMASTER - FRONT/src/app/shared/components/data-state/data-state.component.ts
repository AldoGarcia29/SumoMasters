import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type DataStateKind = 'loading' | 'error' | 'empty';

@Component({
  selector: 'app-data-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-state.component.html',
  styleUrl: './data-state.component.scss',
})
export class DataStateComponent {
  @Input() state: DataStateKind = 'loading';
  @Input() message = '';
  @Input() showRetry = false;
  @Input() compact = false;
  skeletons = [0, 1, 2];

  @Input()
  set skeletonRows(value: number) {
    this.skeletons = Array.from(
      { length: Math.max(1, Math.min(8, value)) },
      (_, index) => index,
    );
  }

  @Output() readonly retryRequested = new EventEmitter<void>();
}
