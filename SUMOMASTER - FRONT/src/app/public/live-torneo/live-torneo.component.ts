import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  interval,
  switchMap,
  timer,
} from 'rxjs';

import {
  CombateLive,
  FilaRankingPublica,
  LiveData,
} from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

const POLL_MS = 10_000;
const ESTADO_FINAL = 'FINALIZADO'; // AJUSTA: debe coincidir con tu enum del backend

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

@Component({
  selector: 'app-live-torneo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './live-torneo.component.html',
  styleUrls: ['./live-torneo.component.css'],
})
export class LiveTorneoComponent implements OnInit, OnDestroy {
  data: LiveData | null = null;
  ranking: FilaRankingPublica[] = [];
  rankingCargado = false;
  error: string | null = null;
  busca = '';
  seg = 0;

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

    // Polling cada 10 s. El catchError va DENTRO del switchMap para que un fallo no mate el timer.
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
          this.seg = 0;
        }),
    );

    // Ranking público (mismo ciclo de 10 s). Si falla, conserva el último ranking mostrado.
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

    // Contador "actualizado hace X s"
    this.subs.add(interval(1000).subscribe(() => this.seg++));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get propios(): CombateLive[] {
    const q = norm(this.busca.trim());
    if (!this.data || !q) return [];
    return this.data.combates.filter((c) =>
      c.robots.some((r) => norm(r).includes(q)),
    );
  }

  get proximo(): CombateLive | undefined {
    return this.propios.find((c) => c.estado !== ESTADO_FINAL);
  }

  esPropio(c: CombateLive): boolean {
    return this.propios.includes(c);
  }

  /** Filas del ranking; si hay texto en el buscador, filtra por robot o equipo. */
  get rankingFiltrado(): FilaRankingPublica[] {
    const q = norm(this.busca.trim());
    if (!q) return this.ranking;
    return this.ranking.filter(
      (f) => norm(f.robot).includes(q) || norm(f.equipo).includes(q),
    );
  }

  get top5Victorias(): FilaRankingPublica[] {
    return [...this.ranking]
      .sort((a, b) => b.victorias - a.victorias || b.puntos - a.puntos)
      .slice(0, 5);
  }

  diferenciaLabel(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  trackFila(_: number, f: FilaRankingPublica): string {
    return f.robot;
  }

  trackCombate(_: number, c: CombateLive): string {
    return `${c.dojo}-${c.numero}`;
  }

  terminado(c: CombateLive): boolean {
    return c.estado === ESTADO_FINAL;
  }
}
