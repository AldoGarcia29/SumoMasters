import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoService } from '../../core/services/torneo.service';
import { Torneo, EstadoTorneo } from '../../core/models/torneo.model';

@Component({
  selector: 'app-reportes-selector',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './reportes-selector.component.html',
  styleUrl: './reportes-selector.component.scss',
})
export class ReportesSelectorComponent implements OnInit {
  private readonly torneoService = inject(TorneoService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly torneos = signal<Torneo[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.torneoService.findAll().subscribe({
      next: (data) => {
        this.torneos.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  categoriaNombre(torneo: Torneo): string {
    const categoria = torneo.categoria;
    return typeof categoria === 'string' ? categoria : categoria?.nombre ?? '—';
  }

  estadoBadgeClass(estado: EstadoTorneo): string {
    switch (estado) {
      case EstadoTorneo.EN_PROGRESO:
        return 'badge--success';
      case EstadoTorneo.PROGRAMADO:
        return 'badge--info';
      default:
        return 'badge--neutral';
    }
  }
}
