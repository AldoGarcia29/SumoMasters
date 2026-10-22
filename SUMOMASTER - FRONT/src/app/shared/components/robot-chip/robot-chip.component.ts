import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Robot } from '../../../core/models/robot.model';
import { RobotFichaDialogService } from '../../../core/services/robot-ficha-dialog.service';

@Component({
  selector: 'app-robot-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="robot-chip"
      [class.robot-chip--clickable]="puedeAbrirFicha"
      [disabled]="!puedeAbrirFicha"
      [attr.aria-label]="puedeAbrirFicha ? 'Abrir ficha de ' + robot?.nombre : null"
      (click)="abrirFicha()"
    >
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
        <span class="robot-chip__name">
          <strong *ngIf="numeroVisible">#{{ numeroLabel }}</strong>
          {{ robot?.nombre ?? '—' }}
        </span>
        <small class="robot-chip__team" *ngIf="showEquipo && equipoNombre">{{ equipoNombre }}</small>
      </span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        min-width: 0;
        max-width: 100%;
      }

      .robot-chip {
        display: flex;
        align-items: center;
        padding: 0;
        gap: 0.5rem;
        min-width: 0;
        max-width: 100%;
        color: inherit;
        text-align: left;
        background: transparent;
        border: 0;
        font: inherit;
      }

      .robot-chip--clickable {
        cursor: pointer;
      }

      .robot-chip--clickable:hover .robot-chip__name {
        color: var(--color-primary, #7043b5);
        text-decoration: underline;
      }

      .robot-chip:disabled {
        opacity: 1;
      }

      .robot-chip__avatar {
        width: 1.8rem;
        height: 1.8rem;
        flex: none;
        object-fit: cover;
        background: var(--color-bg, #f5f3fa);
        border: 1px solid var(--color-border, #e4e0ef);
        border-radius: 0.4rem;
      }

      .robot-chip__avatar--placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted, #6b7280);
      }

      .robot-chip__meta {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.25;
      }

      .robot-chip__name {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--color-text, #1f2937);
      }

      .robot-chip__team {
        overflow: hidden;
        font-size: 0.72rem;
        font-weight: 400;
        color: var(--color-text-muted, #6b7280);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class RobotChipComponent {
  @Input() robot: Robot | null | undefined;
  @Input() showEquipo = true;
  @Input() torneoId: string | null = null;
  @Input() numeroParticipante: number | null = null;
  @Input() participantes?:
    | { robot: Robot | string; numero: number }[]
    | null = null;
  @Input() publico = false;

  constructor(private readonly fichaDialog: RobotFichaDialogService) {}

  get puedeAbrirFicha(): boolean {
    return !!this.torneoId && !!this.robot?._id;
  }

  get numeroLabel(): string {
    return String(this.numeroVisible).padStart(3, '0');
  }

  get numeroVisible(): number | null {
    if (this.numeroParticipante !== null) return this.numeroParticipante;
    const robotId = this.robot?._id;
    if (!robotId) return null;
    const participante = this.participantes?.find((item) =>
      typeof item.robot === 'string'
        ? item.robot === robotId
        : item.robot._id === robotId,
    );
    return participante?.numero ?? null;
  }

  abrirFicha(): void {
    if (!this.puedeAbrirFicha || !this.robot?._id || !this.torneoId) return;
    this.fichaDialog.open({
      torneoId: this.torneoId,
      robotId: this.robot._id,
      numero: this.numeroVisible,
      publico: this.publico,
    });
  }

  get equipoNombre(): string {
    const equipo = this.robot?.equipo;
    if (!equipo) return '';
    return typeof equipo === 'string' ? equipo : equipo.nombre;
  }
}
