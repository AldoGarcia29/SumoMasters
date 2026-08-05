import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Robot } from '../../../core/models/robot.model';

@Component({
  selector: 'app-robot-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="robot-chip">
      <img
        *ngIf="robot?.imagenUrl; else placeholder"
        class="robot-chip__avatar"
        [src]="robot?.imagenUrl"
        [alt]="robot?.nombre"
      />
      <ng-template #placeholder>
        <span class="robot-chip__avatar robot-chip__avatar--placeholder">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <rect x="5" y="9" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <circle cx="9.5" cy="14" r="1.1" fill="currentColor" />
            <circle cx="14.5" cy="14" r="1.1" fill="currentColor" />
            <path d="M12 9V6m-3.5 0h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
      </ng-template>

      <span class="robot-chip__meta">
        <span>{{ robot?.nombre ?? '—' }}</span>
        <small *ngIf="showEquipo && equipoNombre">{{ equipoNombre }}</small>
      </span>
    </span>
  `,
})
export class RobotChipComponent {
  @Input() robot: Robot | null | undefined;
  @Input() showEquipo = true;

  get equipoNombre(): string {
    const equipo = this.robot?.equipo;
    if (!equipo) return '';
    return typeof equipo === 'string' ? equipo : equipo.nombre;
  }
}
