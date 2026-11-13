import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, map } from 'rxjs';

import { TipoCombate } from '../../core/models/categoria.model';
import { Torneo } from '../../core/models/torneo.model';
import { TorneoService } from '../../core/services/torneo.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

@Component({
  selector: 'app-torneo-grupos',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneo-grupos.component.html',
  styleUrl: './torneo-grupos.component.scss',
})
export class TorneoGruposComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sidebarOpen = signal(false);
  readonly torneo = signal<Torneo | null>(null);
  readonly cargando = signal(true);
  readonly generando = signal(false);
  readonly error = signal('');
  readonly errorGeneracion = signal('');
  readonly cantidadGrupos = signal<number | null>(1);
  readonly vista = signal<'grupos' | 'equipos'>('grupos');

  readonly equipos = computed(() => this.torneo()?.equiposInscritos ?? []);
  readonly grupos = computed(() => this.torneo()?.gruposRoboSoccer ?? []);
  readonly maximoGrupos = computed(() => Math.floor(this.equipos().length / 2));

  readonly totalPartidos = computed(() =>
    this.grupos().reduce((total, grupo) => total + grupo.partidos.length, 0),
  );

  readonly cantidadValida = computed(() => {
    const cantidad = this.cantidadGrupos();

    return (
      cantidad !== null &&
      Number.isInteger(cantidad) &&
      cantidad >= 1 &&
      cantidad <= this.maximoGrupos()
    );
  });

  private readonly nombresEquipos = computed(() => {
    const nombres = new Map<string, string>();

    for (const equipo of this.equipos()) {
      if (typeof equipo !== 'string') {
        nombres.set(equipo._id, equipo.nombre);
      }
    }

    return nombres;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se encontró el identificador del torneo.');
      this.cargando.set(false);
      return;
    }

    this.torneoService.findOne(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: (torneo) => {
        if (this.esRoboSoccer(torneo)) {
          this.torneo.set(torneo);
        } else {
          this.error.set('Esta vista corresponde a torneos de Robo Soccer RC.');
        }
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'No se pudo cargar el torneo.'));
      },
    });
  }

  generarGrupos(): void {
    const torneo = this.torneo();
    const cantidad = this.cantidadGrupos();

    if (
      !torneo ||
      cantidad === null ||
      !this.cantidadValida() ||
      this.generando() ||
      this.grupos().length > 0
    ) {
      return;
    }

    this.generando.set(true);
    this.errorGeneracion.set('');

    this.torneoService.generarGrupos(torneo._id, cantidad).pipe(
      map(({ grupos }) => ({
        torneo: { ...torneo, gruposRoboSoccer: grupos },
        recuperado: false,
      })),
      catchError((err) => {
        if (err.status !== 409) throw err;

        return this.torneoService.findOne(torneo._id).pipe(
          map((actual) => ({ torneo: actual, recuperado: true })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.generando.set(false)),
    ).subscribe({
      next: ({ torneo: actual, recuperado }) => {
        if (!this.esRoboSoccer(actual)) {
          this.torneo.set(null);
          this.error.set('El torneo ya no pertenece a Robo Soccer RC.');
          return;
        }

        this.torneo.set(actual);
        this.vista.set('grupos');

        if (recuperado && this.grupos().length === 0) {
          this.cantidadGrupos.set(1);
          this.errorGeneracion.set(
            'No se guardaron los grupos. La lista de equipos se consultó de nuevo. Revisa la configuración y vuelve a intentar.',
          );
        }
      },
      error: (err) => {
        this.errorGeneracion.set(
          extractErrorMessage(err, 'No se pudieron generar los grupos.'),
        );
      },
    });
  }

  actualizarCantidad(valor: number): void {
    this.cantidadGrupos.set(Number.isNaN(valor) ? null : valor);
    this.errorGeneracion.set('');
  }

  nombrePorId(id: string): string {
    return this.nombresEquipos().get(id) ?? 'Equipo sin nombre disponible';
  }

  equipoNombre(equipo: { nombre: string } | string): string {
    return typeof equipo === 'string' ? this.nombrePorId(equipo) : equipo.nombre;
  }

  private esRoboSoccer(torneo: Torneo): boolean {
    return (
      typeof torneo.categoria === 'object' &&
      torneo.categoria?.tipoCombate === TipoCombate.ROBO_SOCCER_RC
    );
  }
}