import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
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
  private hideControlsTimeout?: ReturnType<typeof setTimeout>;
  private torneoId = '';

  readonly data = signal<ProyeccionVersus | null>(null);
  readonly error = signal('');
  readonly controlsVisible = signal(true);

  ngOnInit(): void {
  this.torneoId = this.route.snapshot.queryParamMap.get('torneo') ?? '';
  this.mostrarControles();
  this.subscription = timer(0, 2000)
    .pipe(
      exhaustMap(() =>
        this.api.publicoPrincipal(this.torneoId || undefined).pipe(
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

  @HostListener('document:mousemove')
  mostrarControles(): void {
    this.controlsVisible.set(true);
    if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
    this.hideControlsTimeout = setTimeout(
      () => this.controlsVisible.set(false),
      3_000,
    );
  }

  @HostListener('document:touchstart')
  mostrarControlesAlTocar(): void {
    this.mostrarControles();
  }

  loteRobot(combateId: string, lado: 1 | 2) {
    const combate = this.data()?.lote?.find((item) => item.id === combateId);
    return lado === 1 ? combate?.robot1 : combate?.robot2;
  }

  numeroRobot(numero: number | null | undefined): string {
    return numero == null ? '—' : String(numero).padStart(2, '0');
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.hideControlsTimeout) clearTimeout(this.hideControlsTimeout);
  }

  identificarCombate(
  _: number,
  combate: { _id: string },
): string {
  return combate._id;
}
}