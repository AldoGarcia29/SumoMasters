import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { DojoService } from '../../core/services/dojo.service';
import { CombateService } from '../../core/services/combate.service';
import { RankingService } from '../../core/services/ranking.service';
import { TorneoFlowCacheService } from '../../core/services/torneo-flow-cache.service';
import { calcularRankingLocal } from '../../core/utils/ranking-local.util';
import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';
import { Dojo } from '../../core/models/dojo.model';
import { FilaRanking } from '../../core/models/ranking.model';
import { Robot } from '../../core/models/robot.model';

type TabVista = 'general' | 'bloque' | 'dojo';

@Component({
  selector: 'app-torneo-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent, RobotChipComponent],
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
  private readonly flowCache = inject(TorneoFlowCacheService);

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
    this.torneoService.findOne(this.torneoId).subscribe({
      next: (t) => {
        this.torneo.set(t);
        // Si el ranking ya se resolvió antes de que cargara el torneo (o
        // viceversa) y quedó vacío, completamos con la lista de inscritos.
        if (this.filas().length === 0) {
          this.filas.set(this.filasVaciasDesdeInscritos());
        }
      },
    });
    this.bloqueService.findByTorneo(this.torneoId).subscribe({ next: (b) => this.bloques.set(b) });
    this.dojoService.findAll().subscribe({ next: (d) => this.dojos.set(d) });

    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (combates) => {
        if (combates.length > 0) {
          this.flowCache.setCombates(this.torneoId, combates);
          this.totalCombates.set(combates.length);
          this.combatesFinalizados.set(
            combates.filter((c) => c.estado === 'Finalizado').length,
          );
        } else {
          // Si el backend devuelve vacío, usamos lo que sepamos por el
          // caché de esta sesión (p. ej. lo que se generó/registró hace
          // un momento en Bloques/Enfrentamientos/Resultados).
          const cache = this.flowCache.getCombates(this.torneoId);
          if (cache && cache.length > 0) {
            this.totalCombates.set(cache.length);
            this.combatesFinalizados.set(
              cache.filter((c) => c.estado === 'Finalizado').length,
            );
          }
        }
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
          if (data.length > 0) {
            this.filas.set(data);
          } else {
            // El backend no encontró combates finalizados para calcular el
            // ranking — antes de mostrar la tabla vacía, intentamos
            // calcularlo nosotros mismos con lo que haya en el caché de
            // esta sesión (protección contra la misma inconsistencia de
            // lectura que afecta a otras pantallas del flujo).
            const cache = this.flowCache.getCombates(this.torneoId);
            if (cache && cache.length > 0) {
              let combatesParaCalculo = cache;
              if (this.activeTab() === 'bloque' && this.selectedBloqueId()) {
                combatesParaCalculo = cache.filter(
                  (c) => c.bloque?._id === this.selectedBloqueId(),
                );
              } else if (this.activeTab() === 'dojo' && this.selectedDojoId()) {
                combatesParaCalculo = cache.filter(
                  (c) => c.dojo?._id === this.selectedDojoId(),
                );
              }
              this.filas.set(calcularRankingLocal(combatesParaCalculo));
            } else {
              this.filas.set(this.filasVaciasDesdeInscritos());
            }
          }
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

  /**
   * Cuando todavía no hay ningún combate finalizado (ni siquiera en el
   * caché), en vez de mostrar la tabla completamente vacía, listamos a
   * todos los robots inscritos con sus estadísticas en cero — como una
   * tabla de posiciones normal antes de que arranque la competencia.
   */
  private filasVaciasDesdeInscritos(): FilaRanking[] {
    const robots = this.torneo()?.robotsInscritos ?? [];

    return robots
      .filter((r): r is Robot => !!r && typeof r !== 'string')
      .map((robot, index) => {
        const equipo = robot.equipo;
        const equipoId = typeof equipo === 'string' ? equipo : equipo?._id ?? '';
        const equipoNombre = typeof equipo === 'string' ? equipo : equipo?.nombre ?? '—';

        return {
          posicion: index + 1,
          robotId: robot._id,
          robotNombre: robot.nombre,
          robotImagenUrl: robot.imagenUrl ?? '',
          equipoId,
          equipoNombre,
          combates: 0,
          victorias: 0,
          empates: 0,
          derrotas: 0,
          puntos: 0,
          diferencia: 0,
          ultimoResultado: null,
        };
      });
  }

  diferenciaLabel(valor: number): string {
    return valor > 0 ? `+${valor}` : `${valor}`;
  }

  /** Adapta una fila del ranking al shape que espera `app-robot-chip`, para reusar el mismo diseño de foto+nombre en toda la app. */
  robotChipData(fila: FilaRanking): Robot {
    return {
      _id: fila.robotId,
      nombre: fila.robotNombre,
      imagenUrl: fila.robotImagenUrl,
      equipo: fila.equipoId,
    } as Robot;
  }
}
