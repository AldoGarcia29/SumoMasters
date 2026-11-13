import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { TipoCombate } from '../../core/models/categoria.model';
import { GrupoRoboSoccer, PartidoDeGrupo, Torneo } from '../../core/models/torneo.model';
import { TorneoService } from '../../core/services/torneo.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

interface FilaPosiciones {
  id: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  puntos: number;
}

@Component({
  selector: 'app-torneo-resultados-soccer',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneo-resultados-soccer.component.html',
  styleUrl: './torneo-resultados-soccer.component.scss',
})
export class TorneoResultadosSoccerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly servicio = inject(TorneoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly torneo = signal<Torneo | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly errorGuardado = signal('');
  readonly sidebarOpen = signal(false);

  private readonly nombres = computed(() => {
    const nombres = new Map<string, string>();

    for (const equipo of this.torneo()?.equiposInscritos ?? []) {
      if (typeof equipo !== 'string') {
        nombres.set(equipo._id, equipo.nombre);
      }
    }

    return nombres;
  });

  readonly grupos = computed(() =>
    (this.torneo()?.gruposRoboSoccer ?? []).map((grupo) => ({
      ...grupo,
      tabla: this.calcularTabla(grupo),
    })),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('No se encontró el torneo.');
      this.cargando.set(false);
      return;
    }

    this.servicio.findOne(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: (torneo) => {
        if (
          typeof torneo.categoria === 'string' ||
          torneo.categoria?.tipoCombate !== TipoCombate.ROBO_SOCCER_RC
        ) {
          this.error.set('Selecciona un torneo de Robo Soccer RC.');
          return;
        }

        this.torneo.set(torneo);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'No se pudo cargar el torneo.'));
      },
    });
  }

  nombreEquipo(id: string): string {
    return this.nombres().get(id) ?? id;
  }

  guardar(
    numeroGrupo: number,
    partido: PartidoDeGrupo,
    golesLocal: number,
    golesVisitante: number,
  ): void {
    const torneo = this.torneo();
    if (!torneo || this.guardando() || partido.resultado) return;

    const marcadorValido = [golesLocal, golesVisitante].every(
      (goles) => Number.isSafeInteger(goles) && goles >= 0,
    );

    if (!marcadorValido) {
      this.errorGuardado.set('Captura un número entero de goles para cada equipo.');
      return;
    }

    const { localId, visitanteId } = partido;
    this.errorGuardado.set('');
    this.guardando.set(true);

    this.servicio.registrarResultadoGrupo(torneo._id, numeroGrupo, {
      localId,
      visitanteId,
      golesLocal,
      golesVisitante,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.guardando.set(false)),
    ).subscribe({
      next: ({ resultado }) => {
        this.torneo.set({
          ...torneo,
          gruposRoboSoccer: (torneo.gruposRoboSoccer ?? []).map((grupo) =>
            grupo.numero === numeroGrupo
              ? {
                  ...grupo,
                  partidos: grupo.partidos.map((cruce) =>
                    cruce.localId === localId && cruce.visitanteId === visitanteId
                      ? { ...cruce, resultado }
                      : cruce,
                  ),
                }
              : grupo,
          ),
        });
      },
      error: (err) => {
        this.errorGuardado.set(
          extractErrorMessage(err, 'No se pudo guardar el marcador.'),
        );
      },
    });
  }

  private calcularTabla(grupo: GrupoRoboSoccer) {
    const filas = new Map<string, FilaPosiciones>();

    for (const id of grupo.equipoIds) {
      filas.set(id, {
        id,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        puntos: 0,
      });
    }

    for (const partido of grupo.partidos) {
      const local = filas.get(partido.localId);
      const visitante = filas.get(partido.visitanteId);
      if (!partido.resultado || !local || !visitante) continue;

      const { golesLocal, golesVisitante } = partido.resultado;

      for (const [fila, favor, contra] of [
        [local, golesLocal, golesVisitante],
        [visitante, golesVisitante, golesLocal],
      ] as const) {
        fila.pj++;
        fila.gf += favor;
        fila.gc += contra;
        fila.pg += Number(favor > contra);
        fila.pe += Number(favor === contra);
        fila.pp += Number(favor < contra);
        fila.puntos += favor > contra ? 3 : favor === contra ? 1 : 0;
      }
    }

    return [...filas.values()]
      .map((fila) => ({ ...fila, dg: fila.gf - fila.gc }))
      .sort((a, b) => b.puntos - a.puntos || b.dg - a.dg);
  }
}