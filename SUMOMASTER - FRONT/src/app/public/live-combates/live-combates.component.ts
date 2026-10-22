import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Subscription, catchError, switchMap, timer } from 'rxjs';

import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import { CombateLive, LiveData } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

const POLL_MS = 10_000;
const ESTADO_FINAL = 'Finalizado'; // mismo valor que EstadoCombate.FINALIZADO del backend

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

interface GrupoFase {
  fase: string;
  combates: CombateLive[];
  finalizados: number;
}

@Component({
  selector: 'app-live-combates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LiveUserMenuComponent],
  templateUrl: './live-combates.component.html',
  styleUrls: ['./live-combates.component.css'],
})
export class LiveCombatesComponent implements OnInit, OnDestroy {
  id = '';
  data: LiveData | null = null;
  error: string | null = null;
  busca = '';
  soloPendientes = false;

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
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  terminado(c: CombateLive): boolean {
    return c.estado === ESTADO_FINAL;
  }

  /** Combates del robot buscado. */
  get propios(): CombateLive[] {
    const q = norm(this.busca.trim());
    if (!this.data || !q) return [];
    return this.data.combates.filter((c) =>
      c.robots.some((r) => norm(r).includes(q)),
    );
  }

  get proximo(): CombateLive | undefined {
    return this.propios.find((c) => !this.terminado(c));
  }

  esPropio(c: CombateLive): boolean {
    return this.propios.includes(c);
  }

  /** Combates agrupados por fase, en el orden en que los manda el backend (cronológico). */
  get grupos(): GrupoFase[] {
    const mapa = new Map<string, CombateLive[]>();
    for (const c of this.data?.combates ?? []) {
      if (this.soloPendientes && this.terminado(c)) continue;
      const fase = c.fase ?? 'Sin fase';
      if (!mapa.has(fase)) mapa.set(fase, []);
      mapa.get(fase)!.push(c);
    }
    return Array.from(mapa, ([fase, combates]) => ({
      fase,
      combates,
      finalizados: combates.filter((c) => this.terminado(c)).length,
    }));
  }

  get total(): number {
    return this.data?.combates.length ?? 0;
  }

  trackGrupo(_: number, g: GrupoFase): string {
    return g.fase;
  }

  trackCombate(_: number, c: CombateLive): string {
    return `${c.fase}-${c.bloque}-${c.dojo}-${c.numero}`;
  }
}
