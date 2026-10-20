import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  private readonly route = inject(ActivatedRoute);
  private subscription?: Subscription;

  readonly data = signal<ProyeccionVersus | null>(null);
  readonly error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('Torneo no válido.');
      return;
    }

    this.subscription = timer(0, 3000).pipe(
      exhaustMap(() =>
        this.api.publico(id).pipe(
          catchError(err => {
            if (err.status === 404) {
              this.data.set(null);
              this.error.set('El torneo no está disponible al público.');
            } else {
              this.error.set(
                'Sin conexión. La información puede estar desactualizada; reintentando…',
              );
            }
            return EMPTY;
          }),
        ),
      ),
    ).subscribe(data => {
      this.data.set(data);
      this.error.set('');
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
}