import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import { TorneoResumen } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

const POLL_MS = 5_000;

interface GrupoFecha {
  clave: string;
  torneos: TorneoResumen[];
}

@Component({
  selector: 'app-torneos-publicos',
  standalone: true,
  imports: [CommonModule, RouterLink, LiveUserMenuComponent],
  templateUrl: './torneos-publicos.component.html',
  styleUrls: ['./torneos-publicos.component.css'],
})
export class TorneosPublicosComponent implements OnInit, OnDestroy {
  lista: TorneoResumen[] | null = null;
  error: string | null = null;
  horaActual = new Date();
  ultimaActualizacion: Date | null = null;
  segundosDesdeActualizacion = 0;

  private readonly subs = new Subscription();

  constructor(private readonly api: PublicApiService) {}

  ngOnInit(): void {
    const visible$ = merge(
      of(!document.hidden),
      fromEvent(document, 'visibilitychange').pipe(
        map(() => !document.hidden),
      ),
    ).pipe(distinctUntilChanged());

    this.subs.add(
      visible$
        .pipe(
          switchMap((visible) => (visible ? timer(0, POLL_MS) : EMPTY)),
          switchMap(() =>
            this.api.getTorneos().pipe(
              catchError(() => {
                this.error = 'No se pudo cargar la lista de torneos.';
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((torneos) => {
          this.lista = torneos;
          this.error = null;
          this.ultimaActualizacion = new Date();
          this.segundosDesdeActualizacion = 0;
        }),
    );

    this.subs.add(
      timer(0, 1_000).subscribe(() => {
        this.horaActual = new Date();
        if (this.ultimaActualizacion) {
          this.segundosDesdeActualizacion = Math.floor(
            (Date.now() - this.ultimaActualizacion.getTime()) / 1_000,
          );
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get torneosEnVivo(): TorneoResumen[] {
    return (this.lista ?? []).filter(
      (torneo) =>
        torneo.combatesEnCurso > 0 || torneo.estado === 'En progreso',
    );
  }

  get torneosFinalizados(): TorneoResumen[] {
    return (this.lista ?? []).filter(
      (torneo) => torneo.estado === 'Finalizado',
    );
  }

  get proximosPorFecha(): GrupoFecha[] {
    const torneos = (this.lista ?? []).filter(
      (torneo) =>
        torneo.estado !== 'En progreso' && torneo.estado !== 'Finalizado',
    );
    const grupos = new Map<string, TorneoResumen[]>();
    for (const torneo of torneos) {
      const clave = torneo.fecha?.slice(0, 10) ?? 'Por confirmar';
      const grupo = grupos.get(clave) ?? [];
      grupo.push(torneo);
      grupos.set(clave, grupo);
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, items]) => ({ clave, torneos: items }));
  }

  trackTorneo(_: number, torneo: TorneoResumen): string {
    return torneo.id;
  }

  trackFecha(_: number, grupo: GrupoFecha): string {
    return grupo.clave;
  }

  fechaLegible(clave: string): Date | null {
    return clave === 'Por confirmar' ? null : new Date(`${clave}T12:00:00`);
  }
}
