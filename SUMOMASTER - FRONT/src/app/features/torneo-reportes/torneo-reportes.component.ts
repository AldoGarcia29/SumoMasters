import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';
import { RankingService } from '../../core/services/ranking.service';
import { Torneo } from '../../core/models/torneo.model';
import { Combate } from '../../core/models/combate.model';
import { FilaRanking } from '../../core/models/ranking.model';
import { Robot } from '../../core/models/robot.model';

type ReporteId =
  | 'ranking'
  | 'resultados-ronda'
  | 'historial'
  | 'equipos'
  | 'ganadores';

@Component({
  selector: 'app-torneo-reportes',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneo-reportes.component.html',
  styleUrl: './torneo-reportes.component.scss',
})
export class TorneoReportesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
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
  readonly generando = signal<ReporteId | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly reportes: { id: ReporteId; titulo: string; descripcion: string; color: string }[] = [
    { id: 'ranking', titulo: 'Ranking general', descripcion: 'Exportar ranking completo del torneo', color: 'purple' },
    { id: 'resultados-ronda', titulo: 'Resultados por ronda', descripcion: 'Reporte de resultados de cada ronda', color: 'blue' },
    { id: 'historial', titulo: 'Historial de combates', descripcion: 'Reporte detallado de todos los combates', color: 'teal' },
    { id: 'equipos', titulo: 'Equipos participantes', descripcion: 'Listado de todos los equipos inscritos', color: 'orange' },
    { id: 'ganadores', titulo: 'Ganadores por categoría', descripcion: 'Resumen de ganadores por categoría', color: 'pink' },
  ];

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });
  }

  generar(reporteId: ReporteId): void {
    this.generando.set(reporteId);
    this.errorMessage.set(null);

    switch (reporteId) {
      case 'ranking':
        this.generarRanking();
        break;
      case 'resultados-ronda':
        this.generarResultadosPorRonda();
        break;
      case 'historial':
        this.generarHistorial();
        break;
      case 'equipos':
        this.generarEquipos();
        break;
      case 'ganadores':
        this.generarGanadores();
        break;
    }
  }

  private generarRanking(): void {
    this.rankingService.calcular(this.torneoId).subscribe({
      next: (filas) => {
        const rows = filas.map((f) => [
          f.posicion,
          f.equipoNombre,
          f.robotNombre,
          f.combates,
          f.victorias,
          f.empates,
          f.derrotas,
          f.puntos,
          f.diferencia,
        ]);
        this.descargarCsv(
          'ranking-general',
          ['Pos.', 'Equipo', 'Robot', 'Combates', 'Victorias', 'Empates', 'Derrotas', 'Puntos', 'Diferencia'],
          rows,
        );
        this.generando.set(null);
      },
      error: () => this.onError(),
    });
  }

  private generarResultadosPorRonda(): void {
    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (combates) => {
        const rows = combates.map((c) => [
          c.fase,
          c.bloque?.nombre ?? '—',
          c.numero,
          c.robot1.nombre,
          c.robot2.nombre,
          c.resultado ?? 'Sin registrar',
          c.metodoVictoria ?? '—',
          c.estado,
        ]);
        this.descargarCsv(
          'resultados-por-ronda',
          ['Fase', 'Bloque', 'Combate #', 'Robot 1', 'Robot 2', 'Resultado', 'Método', 'Estado'],
          rows,
        );
        this.generando.set(null);
      },
      error: () => this.onError(),
    });
  }

  private generarHistorial(): void {
    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (combates) => {
        const rows = combates.map((c) => [
          c.numero,
          c.createdAt ? new Date(c.createdAt).toLocaleString('es-MX') : '—',
          c.bloque?.nombre ?? '—',
          c.dojo?.nombre ?? '—',
          c.robot1.nombre,
          c.robot2.nombre,
          c.resultado ?? '—',
          c.duracionSegundos ?? '—',
          c.jueces.join(' / '),
          c.observaciones,
        ]);
        this.descargarCsv(
          'historial-de-combates',
          ['ID', 'Fecha', 'Bloque', 'Dojo', 'Robot 1', 'Robot 2', 'Resultado', 'Duración (s)', 'Jueces', 'Observaciones'],
          rows,
        );
        this.generando.set(null);
      },
      error: () => this.onError(),
    });
  }

  private generarEquipos(): void {
    const torneo = this.torneo();
    if (!torneo) {
      this.onError();
      return;
    }

    const equiposMap = new Map<string, { nombre: string; institucion: string; robots: string[] }>();

    for (const r of torneo.robotsInscritos) {
      const robot = r as Robot;
      if (typeof robot === 'string') continue;
      const equipo = robot.equipo;
      const equipoId = typeof equipo === 'string' ? equipo : equipo?._id ?? '';
      const equipoNombre = typeof equipo === 'string' ? equipo : equipo?.nombre ?? '—';

      const actual = equiposMap.get(equipoId) ?? { nombre: equipoNombre, institucion: '—', robots: [] };
      actual.robots.push(robot.nombre);
      equiposMap.set(equipoId, actual);
    }

    const rows = Array.from(equiposMap.values()).map((e) => [e.nombre, e.institucion, e.robots.join(', ')]);
    this.descargarCsv('equipos-participantes', ['Equipo', 'Institución', 'Robots inscritos'], rows);
    this.generando.set(null);
  }

  private generarGanadores(): void {
    const torneo = this.torneo();
    this.rankingService.calcular(this.torneoId).subscribe({
      next: (filas: FilaRanking[]) => {
        const campeon = filas[0];
        const rows = campeon
          ? [[
              (torneo?.categoria as any)?.nombre ?? '—',
              campeon.robotNombre,
              campeon.equipoNombre,
              campeon.puntos,
              campeon.victorias,
            ]]
          : [];
        this.descargarCsv(
          'ganadores-por-categoria',
          ['Categoría', 'Robot campeón', 'Equipo', 'Puntos', 'Victorias'],
          rows,
        );
        this.generando.set(null);
      },
      error: () => this.onError(),
    });
  }

  private onError(): void {
    this.generando.set(null);
    this.errorMessage.set('No se pudo generar el reporte. Intenta nuevamente.');
  }

  private descargarCsv(nombreArchivo: string, headers: string[], rows: (string | number)[][]): void {
    const escape = (value: string | number) => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const contenido = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const torneoSlug = (this.torneo()?.nombre ?? 'torneo').toLowerCase().replace(/\s+/g, '-');

    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}-${torneoSlug}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
