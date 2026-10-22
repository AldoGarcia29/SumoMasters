import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import { extractErrorMessage } from '../../../core/utils/error-message.util';
import { RobotFicha } from '../../../core/models/robot-ficha.model';
import { RobotService } from '../../../core/services/robot.service';
import {
  RobotFichaDialogSelection,
  RobotFichaDialogService,
} from '../../../core/services/robot-ficha-dialog.service';
import { PublicApiService } from '../../../public/services/public-api.service';

@Component({
  selector: 'app-robot-ficha-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="selection"
      class="ficha-backdrop"
      (click)="close()"
      role="presentation"
    >
      <section
        class="ficha"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-title"
        (click)="$event.stopPropagation()"
      >
        <button
          type="button"
          class="ficha__close"
          aria-label="Cerrar ficha del robot"
          (click)="close()"
        >
          ×
        </button>

        <p class="ficha__eyebrow">Ficha del robot</p>
        <div *ngIf="loading" class="ficha__state">Cargando ficha…</div>
        <p *ngIf="error" class="ficha__error" role="alert">{{ error }}</p>

        <ng-container *ngIf="ficha as item">
          <header class="ficha__header">
            <span class="ficha__number">
              #{{ numero(item.robot.numero ?? selection.numero) }}
            </span>
            <div>
              <h2 id="ficha-title">{{ item.robot.nombre }}</h2>
              <p>
                {{ item.equipo.nombre }} · {{ item.equipo.institucion }}
              </p>
            </div>
          </header>

          <p class="ficha__weight" *ngIf="item.robot.pesoKg !== null">
            Peso: {{ item.robot.pesoKg | number: '1.0-2' }} kg
          </p>

          <dl class="ficha__details">
            <div><dt>Categoría</dt><dd>{{ item.categoria }}</dd></div>
            <div><dt>Grupo</dt><dd>{{ item.grupo || 'Sin grupo' }}</dd></div>
            <div><dt>Dojo</dt><dd>{{ item.dojo || 'Sin asignar' }}</dd></div>
            <div>
              <dt>Récord del torneo</dt>
              <dd>{{ item.record.victorias }} G - {{ item.record.derrotas }} P</dd>
            </div>
          </dl>

          <section class="ficha__combates">
            <div>
              <h3>Último combate</h3>
              <p *ngIf="item.ultimoCombate as last">
                #{{ last.numero }} vs {{ last.rival }} · {{ last.estado }}
              </p>
              <small *ngIf="item.ultimoCombate as last">
                {{ last.dojo || 'Dojo sin asignar' }}
                <span *ngIf="last.horarioProgramado">
                  · {{ last.horarioProgramado | date: 'short' }}
                </span>
              </small>
              <p *ngIf="!item.ultimoCombate">Sin combates finalizados</p>
            </div>
            <div>
              <h3>Próximo combate</h3>
              <p *ngIf="item.proximoCombate as next">
                #{{ next.numero }} vs {{ next.rival }} · {{ next.estado }}
              </p>
              <small *ngIf="item.proximoCombate as next">
                {{ next.dojo || 'Dojo sin asignar' }}
                <span *ngIf="next.horarioProgramado">
                  · {{ next.horarioProgramado | date: 'short' }}
                </span>
              </small>
              <p *ngIf="!item.proximoCombate">Sin combates pendientes</p>
            </div>
          </section>
        </ng-container>
      </section>
    </div>
  `,
  styles: [
    `
      .ficha-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1500;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgb(19 13 35 / 58%);
      }
      .ficha {
        position: relative;
        width: min(100%, 34rem);
        max-height: min(90vh, 44rem);
        overflow-y: auto;
        padding: clamp(1.25rem, 4vw, 2rem);
        color: var(--color-text, #241b35);
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #e5def2);
        border-radius: 1.25rem;
        box-shadow: 0 1.5rem 4rem rgb(15 8 30 / 28%);
      }
      .ficha__close {
        position: absolute;
        top: 0.8rem;
        right: 0.9rem;
        width: 2.25rem;
        height: 2.25rem;
        color: var(--color-text-muted, #625973);
        background: transparent;
        border: 0;
        border-radius: 50%;
        font-size: 1.8rem;
        line-height: 1;
        cursor: pointer;
      }
      .ficha__eyebrow {
        margin: 0 0 1rem;
        color: var(--color-primary, #7043b5);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .ficha__header {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding-right: 2rem;
      }
      .ficha__number {
        display: grid;
        min-width: 4.5rem;
        min-height: 4.5rem;
        place-items: center;
        color: #fff;
        background: var(--color-primary, #7043b5);
        border-radius: 1rem;
        font-size: 1.3rem;
        font-weight: 800;
      }
      .ficha__header h2,
      .ficha__header p,
      .ficha__combates h3,
      .ficha__combates p {
        margin: 0;
      }
      .ficha__header h2 { font-size: clamp(1.35rem, 5vw, 1.8rem); }
      .ficha__header p,
      .ficha__weight { color: var(--color-text-muted, #625973); }
      .ficha__weight { margin: 1rem 0 0; font-size: 0.82rem; }
      .ficha__details {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin: 1.25rem 0;
      }
      .ficha__details div {
        padding: 0.8rem;
        background: var(--color-bg, #f7f4fb);
        border-radius: 0.8rem;
      }
      .ficha__details dt { color: var(--color-text-muted, #625973); font-size: 0.74rem; }
      .ficha__details dd { margin: 0.2rem 0 0; font-weight: 650; }
      .ficha__combates { display: grid; gap: 0.8rem; }
      .ficha__combates > div {
        padding: 0.85rem;
        border: 1px solid var(--color-border, #e5def2);
        border-radius: 0.8rem;
      }
      .ficha__combates h3 { margin-bottom: 0.35rem; font-size: 0.9rem; }
      .ficha__combates p, .ficha__state { color: var(--color-text-muted, #625973); }
      .ficha__combates small { display: block; margin-top: 0.35rem; color: var(--color-text-muted, #625973); }
      .ficha__error { color: var(--color-danger, #b42318); }
      @media (min-width: 36rem) {
        .ficha__combates { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `,
  ],
})
export class RobotFichaModalComponent implements OnInit, OnDestroy {
  private readonly dialog = inject(RobotFichaDialogService);
  private readonly robots = inject(RobotService);
  private readonly publicApi = inject(PublicApiService);
  private subscription?: Subscription;

  selection: RobotFichaDialogSelection | null = null;
  ficha: RobotFicha | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.subscription = this.dialog.selection$
      .pipe(
        switchMap((selection) => {
          this.selection = selection;
          this.ficha = null;
          this.error = null;
          this.loading = !!selection;
          if (!selection) return of(null);

          const request = selection.publico
            ? this.publicApi.getFichaRobot(
                selection.torneoId,
                selection.robotId,
              )
            : this.robots.fichaTorneo(
                selection.torneoId,
                selection.robotId,
              );

          return request.pipe(
            catchError((err: unknown) => {
              this.error = extractErrorMessage(
                err,
                'No se pudo cargar la ficha del robot.',
              );
              return of(null);
            }),
          );
        }),
      )
      .subscribe((ficha) => {
        this.ficha = ficha;
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  close(): void {
    this.dialog.close();
  }

  numero(numero: number | null): string {
    return numero === null ? '---' : String(numero).padStart(3, '0');
  }
}
