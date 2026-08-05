import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TorneoService } from '../../core/services/torneo.service';
import { EquipoService } from '../../core/services/equipo.service';
import { RobotService } from '../../core/services/robot.service';
import { CombateService } from '../../core/services/combate.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { EstadoTorneo } from '../../core/models/torneo.model';
import { EstadoRobot } from '../../core/models/robot.model';

interface StatCard {
  icon: 'calendar' | 'users' | 'robot' | 'swords';
  color: 'purple' | 'orange' | 'blue' | 'green';
  label: string;
  value: number;
  link: string;
}

interface TournamentRow {
  id: string;
  name: string;
  date: string;
  status: string;
  statusTone: 'success' | 'info' | 'neutral';
  participants: number;
}

interface ActivityItem {
  icon: 'users' | 'robot' | 'trophy';
  before: string;
  highlight: string;
  after: string;
  time: string;
}

interface DonutSegment {
  label: string;
  value: number;
  percent: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

/** Radio y circunferencia del anillo del gráfico "Resumen general" */
const DONUT_RADIUS = 54;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function buildDonutSegments(
  raw: { label: string; value: number; color: string }[],
): DonutSegment[] {
  const total = raw.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];

  let cumulativePercent = 0;

  return raw
    .filter((item) => item.value > 0)
    .map((item) => {
      const percent = Math.round((item.value / total) * 100);
      const segment: DonutSegment = {
        ...item,
        percent,
        dashArray: `${(percent / 100) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`,
        dashOffset: -((cumulativePercent / 100) * DONUT_CIRCUMFERENCE),
      };
      cumulativePercent += percent;
      return segment;
    });
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly torneoService = inject(TorneoService);
  private readonly equipoService = inject(EquipoService);
  private readonly robotService = inject(RobotService);
  private readonly combateService = inject(CombateService);
  private readonly notificationsService = inject(NotificationsService);

  /** Estado del menú lateral en mobile/tablet (drawer deslizable) */
  readonly sidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((value) => !value);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly donutRadius = DONUT_RADIUS;
  readonly donutCircumference = DONUT_CIRCUMFERENCE;

  readonly loading = signal(true);

  readonly stats = signal<StatCard[]>([]);
  readonly tournaments = signal<TournamentRow[]>([]);
  readonly donutTotal = signal(0);
  readonly donutSegments = signal<DonutSegment[]>([]);

  ngOnInit(): void {
    this.notificationsService.load();

    forkJoin({
      torneos: this.torneoService.findAll(),
      equipos: this.equipoService.findAll(),
      robots: this.robotService.findAll(),
      combates: this.combateService.statsGlobal(),
    }).subscribe({
      next: ({ torneos, equipos, robots, combates }) => {
        const torneosActivos = torneos.filter(
          (t) => t.estado !== EstadoTorneo.FINALIZADO,
        ).length;

        this.stats.set([
          { icon: 'calendar', color: 'purple', label: 'Torneos activos', value: torneosActivos, link: '/torneos' },
          { icon: 'users', color: 'orange', label: 'Equipos registrados', value: equipos.length, link: '/equipos' },
          { icon: 'robot', color: 'blue', label: 'Robots registrados', value: robots.length, link: '/robots' },
          { icon: 'swords', color: 'green', label: 'Combates realizados', value: combates.finalizados, link: '/combates' },
        ]);

        this.tournaments.set(
          [...torneos]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
            .slice(0, 4)
            .map((t) => ({
              id: t._id,
              name: t.nombre,
              date: new Date(t.fecha).toLocaleDateString('es-MX'),
              status: t.estado,
              statusTone:
                t.estado === EstadoTorneo.EN_PROGRESO
                  ? 'success'
                  : t.estado === EstadoTorneo.PROGRAMADO
                    ? 'info'
                    : 'neutral',
              participants: t.robotsInscritos.length,
            })),
        );

        const porEstado = (estado: EstadoRobot) =>
          robots.filter((r) => r.estado === estado).length;

        this.donutTotal.set(robots.length);
        this.donutSegments.set(
          buildDonutSegments([
            { label: 'Activos', value: porEstado(EstadoRobot.ACTIVO), color: '#22c55e' },
            { label: 'Mantenimiento', value: porEstado(EstadoRobot.MANTENIMIENTO), color: '#3b82f6' },
            { label: 'Inactivos', value: porEstado(EstadoRobot.INACTIVO), color: '#f97316' },
            { label: 'Retirados', value: porEstado(EstadoRobot.RETIRADO), color: '#94a3b8' },
          ]),
        );

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get recentActivity(): ActivityItem[] {
    return this.notificationsService.notifications().map((n) => ({
      icon: n.icon,
      before: n.before,
      highlight: n.highlight,
      after: n.after,
      time: this.notificationsService.relativeTime(n.date),
    }));
  }
}
