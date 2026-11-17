import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { EMPTY, Subscription, catchError, exhaustMap, timer } from 'rxjs';
import {
  ProyeccionVersus,
  RobotVersus,
  VersusService,
} from '../../core/services/versus.service';

@Component({
  selector: 'app-versus',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './versus.component.html',
  styleUrl: './versus.component.scss',
})

export class VersusComponent implements OnInit, OnDestroy {
  private readonly api = inject(VersusService);
  private subscription?: Subscription;

  readonly data = signal<ProyeccionVersus | null>(null);
  readonly error = signal('');

  ngOnInit(): void {
  this.subscription = timer(0, 3000)
    .pipe(
      exhaustMap(() =>
        this.api.publicoPrincipal().pipe(
          catchError(() => {
            this.error.set(
              'Sin conexión. La información puede estar desactualizada; reintentando…',
            );

            return EMPTY;
          }),
        ),
      ),
    )
    .subscribe((data) => {
      this.data.set(data);

      this.error.set(
        data
          ? ''
          : 'Pantalla en espera. Selecciona un combate de un torneo público.',
      );
    });
}

  equipo(robot: RobotVersus | null): string {
    const equipo = robot?.equipo;
    return equipo && typeof equipo === 'object' ? equipo.nombre : '';
  }

  async pantallaCompleta(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      this.error.set('No se pudo activar pantalla completa. Puedes usar F11.');
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  identificarCombate(
  _: number,
  combate: { _id: string },
): string {
  return combate._id;
}
}