import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TorneoService } from './torneo.service';
import { EquipoService } from './equipo.service';
import { RobotService } from './robot.service';

export interface AppNotification {
  id: string;
  icon: 'trophy' | 'users' | 'robot';
  before: string;
  highlight: string;
  after: string;
  date: Date;
  read: boolean;
}

const MAX_ITEMS = 8;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly torneoService = inject(TorneoService);
  private readonly equipoService = inject(EquipoService);
  private readonly robotService = inject(RobotService);

  private readonly notificationsSignal = signal<AppNotification[]>([]);
  private readonly loadedSignal = signal(false);

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = computed(
    () => this.notificationsSignal().filter((n) => !n.read).length,
  );

  /** Carga (una vez por sesión) la actividad reciente real desde el backend. */
  load(force = false): void {
    if (this.loadedSignal() && !force) return;

    forkJoin({
      torneos: this.torneoService.findAll(),
      equipos: this.equipoService.findAll(),
      robots: this.robotService.findAll(),
    }).subscribe({
      next: ({ torneos, equipos, robots }) => {
        const items: AppNotification[] = [];

        for (const t of torneos) {
          if (!t.createdAt) continue;
          items.push({
            id: `torneo-${t._id}`,
            icon: 'trophy',
            before: 'Se creó el torneo',
            highlight: t.nombre,
            after: '',
            date: new Date(t.createdAt),
            read: true,
          });
        }

        for (const e of equipos) {
          if (!e.createdAt) continue;
          items.push({
            id: `equipo-${e._id}`,
            icon: 'users',
            before: 'Se registró el equipo',
            highlight: e.nombre,
            after: e.institucion ? `de ${e.institucion}` : '',
            date: new Date(e.createdAt),
            read: true,
          });
        }

        for (const r of robots) {
          if (!r.createdAt) continue;
          items.push({
            id: `robot-${r._id}`,
            icon: 'robot',
            before: 'Nuevo robot registrado:',
            highlight: r.nombre,
            after: '',
            date: new Date(r.createdAt),
            read: true,
          });
        }

        items.sort((a, b) => b.date.getTime() - a.date.getTime());

        const recientes = items.slice(0, MAX_ITEMS);
        // Se marcan como "no leídas" las 3 más recientes, simulando notificaciones nuevas.
        recientes.forEach((item, index) => {
          item.read = index >= 3;
        });

        this.notificationsSignal.set(recientes);
        this.loadedSignal.set(true);
      },
    });
  }

  markAllAsRead(): void {
    this.notificationsSignal.update((items) =>
      items.map((item) => ({ ...item, read: true })),
    );
  }

  relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return 'Justo ahora';
    if (minutes < 60) return `Hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days} d`;

    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
