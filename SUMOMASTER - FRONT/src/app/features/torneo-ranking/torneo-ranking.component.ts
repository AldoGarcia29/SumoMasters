import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { DojoService } from '../../core/services/dojo.service';
import { CombateService } from '../../core/services/combate.service';
import { RankingService } from '../../core/services/ranking.service';
import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';
import { Dojo } from '../../core/models/dojo.model';
import { FilaRanking } from '../../core/models/ranking.model';

type TabVista = 'general' | 'bloque' | 'dojo';

@Component({
  selector: 'app-torneo-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneo-ranking.component.html',
  styleUrl: './torneo-ranking.component.scss',
})
export class TorneoRankingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly bloqueService = inject(BloqueService);
  private readonly dojoService = inject(DojoService);
  private readonly combateService = inject(CombateService);
  private readonly rankingService = inject(RankingService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly torneoId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly torneo = signal<Torneo | null>(null);
  readonly bloques = signal<Bloque[]>([]);
  readonly dojos = signal<Dojo[]>([]);

  readonly totalCombates = signal(0);
  readonly combatesFinalizados = signal(0);

  readonly activeTab = signal<TabVista>('general');
  readonly selectedBloqueId = signal<string>('');
  readonly selectedDojoId = signal<string>('');
  readonly searchTerm = signal('');

  readonly loading = signal(false);
  readonly filas = signal<FilaRanking[]>([]);
  readonly lastUpdated = signal<Date | null>(null);

  readonly filasFiltradas = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.filas();
    return this.filas().filter(
      (f) =>
        f.robotNombre.toLowerCase().includes(term) ||
        f.equipoNombre.toLowerCase().includes(term),
    );
  });

  readonly top5PorVictorias = computed(() =>
    [...this.filas()].sort((a, b) => b.victorias - a.victorias).slice(0, 5),
  );

  readonly distribucion = computed(() => {
    const victorias = this.filas().reduce((acc, f) => acc + f.victorias, 0);
    const empates = this.filas().reduce((acc, f) => acc + f.empates, 0);
    const derrotas = this.filas().reduce((acc, f) => acc + f.derrotas, 0);
    const total = victorias + empates + derrotas || 1;

    return {
      victorias,
      empates,
      derrotas,
      total,
      pctVictorias: Math.round((victorias / total) * 1000) / 10,
      pctEmpates: Math.round((empates / total) * 1000) / 10,
      pctDerrotas: Math.round((derrotas / total) * 1000) / 10,
    };
  });

  /** Ángulos acumulados para dibujar el donut SVG con `stroke-dasharray`. */
  readonly donutSegments = computed(() => {
    const d = this.distribucion();
    const circunferencia = 2 * Math.PI * 40;
    const victorias = (d.pctVictorias / 100) * circunferencia;
    const empates = (d.pctEmpates / 100) * circunferencia;
    const derrotas = (d.pctDerrotas / 100) * circunferencia;

    return {
      circunferencia,
      victorias,
      empates,
      derrotas,
      offsetEmpates: victorias,
      offsetDerrotas: victorias + empates,
    };
  });

  readonly equiposParticipantes = computed(
    () => new Set(this.filas().map((f) => f.equipoId)).size,
  );

  readonly equiposConVictoria = computed(
    () => new Set(this.filas().filter((f) => f.victorias > 0).map((f) => f.equipoId)).size,
  );

  readonly porcentajeCompletado = computed(() => {
    if (this.totalCombates() === 0) return 0;
    return Math.round((this.combatesFinalizados() / this.totalCombates()) * 100);
  });

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });
    this.bloqueService.findByTorneo(this.torneoId).subscribe({ next: (b) => this.bloques.set(b) });
    this.dojoService.findAll().subscribe({ next: (d) => this.dojos.set(d) });

    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (combates) => {
        this.totalCombates.set(combates.length);
        this.combatesFinalizados.set(combates.filter((c) => c.estado === 'Finalizado').length);
      },
    });

    this.cargarRanking();
  }

  cargarRanking(): void {
    this.loading.set(true);
    this.rankingService
      .calcular(this.torneoId, {
        bloque: this.activeTab() === 'bloque' ? this.selectedBloqueId() : undefined,
        dojo: this.activeTab() === 'dojo' ? this.selectedDojoId() : undefined,
      })
      .subscribe({
        next: (data) => {
          this.filas.set(data);
          this.lastUpdated.set(new Date());
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setTab(tab: TabVista): void {
    this.activeTab.set(tab);

    if (tab === 'bloque' && !this.selectedBloqueId() && this.bloques().length > 0) {
      this.selectedBloqueId.set(this.bloques()[0]._id);
    }
    if (tab === 'dojo' && !this.selectedDojoId() && this.dojos().length > 0) {
      this.selectedDojoId.set(this.dojos()[0]._id);
    }

    this.cargarRanking();
  }

  onBloqueChange(id: string): void {
    this.selectedBloqueId.set(id);
    this.cargarRanking();
  }

  onDojoChange(id: string): void {
    this.selectedDojoId.set(id);
    this.cargarRanking();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  ultimoResultadoClass(resultado: string | null): string {
    switch (resultado) {
      case 'Victoria':
        return 'badge--success';
      case 'Empate':
        return 'badge--warning';
      case 'Derrota':
        return 'badge--danger';
      default:
        return 'badge--neutral';
    }
  }

  diferenciaLabel(valor: number): string {
    return valor > 0 ? `+${valor}` : `${valor}`;
  }
}
