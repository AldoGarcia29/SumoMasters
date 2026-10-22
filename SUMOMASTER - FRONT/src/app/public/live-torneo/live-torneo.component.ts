import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Subscription, catchError, switchMap, timer } from 'rxjs';
import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import { FilaRankingPublica, LiveData } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

const POLL_MS = 10_000;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Nombre de equipo para mostrar: los equipos "por defecto" se muestran como "Sin equipo". */
const SIN_EQUIPO = 'Sin equipo';
const equipoLabel = (nombre: string | null | undefined): string => {
  const n = (nombre ?? '').trim();
  if (!n || n === '—' || norm(n) === 'equipo (default)') return SIN_EQUIPO;
  return n;
};

@Component({
  selector: 'app-live-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LiveUserMenuComponent],
  templateUrl: './live-torneo.component.html',
  styleUrls: ['./live-torneo.component.css'],
})
export class LiveTorneoComponent implements OnInit, OnDestroy {
  id = '';
  data: LiveData | null = null;
  ranking: FilaRankingPublica[] = [];
  rankingCargado = false;
  error: string | null = null;
  busca = '';

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private api: PublicApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Torneo no disponible';
      return;
    }
    this.id = id;

    // Datos del torneo (título y fase). Polling cada 10 s; el catchError va DENTRO del switchMap.
    this.subs.add(
      timer(0, POLL_MS)
        .pipe(
          switchMap(() =>
            this.api.getLive(id).pipe(
              catchError((err) => {
                this.error =
                  err?.status === 404
                    ? 'Torneo no disponible'
                    : 'Sin conexión, reintentando…';
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((d) => {
          this.data = d;
          this.error = null;
        }),
    );

    // Ranking público. Si falla, conserva el último ranking mostrado.
    this.subs.add(
      timer(0, POLL_MS)
        .pipe(
          switchMap(() =>
            this.api.getRanking(id).pipe(catchError(() => EMPTY)),
          ),
        )
        .subscribe((r) => {
          this.ranking = r.filas;
          this.rankingCargado = true;
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** Filas del ranking; si hay texto en el buscador, filtra por robot o equipo. */
  get rankingFiltrado(): FilaRankingPublica[] {
    const q = norm(this.busca.trim());
    if (!q) return this.ranking;
    return this.ranking.filter(
      (f) =>
        norm(f.robot).includes(q) || norm(equipoLabel(f.equipo)).includes(q),
    );
  }

  equipoLabel(nombre: string | null | undefined): string {
    return equipoLabel(nombre);
  }

  diferenciaLabel(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  trackFila(_: number, f: FilaRankingPublica): string {
    return f.robot;
  }
}
