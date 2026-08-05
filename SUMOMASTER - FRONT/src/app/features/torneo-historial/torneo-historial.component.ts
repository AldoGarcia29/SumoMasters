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
import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';
import { Dojo } from '../../core/models/dojo.model';
import { Combate, EstadoCombate } from '../../core/models/combate.model';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-torneo-historial',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent, RobotChipComponent],
  templateUrl: './torneo-historial.component.html',
  styleUrl: './torneo-historial.component.scss',
})
export class TorneoHistorialComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly bloqueService = inject(BloqueService);
  private readonly dojoService = inject(DojoService);
  private readonly combateService = inject(CombateService);

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

  readonly combates = signal<Combate[]>([]);
  readonly loading = signal(false);
  readonly page = signal(1);

  readonly searchTerm = signal('');
  readonly bloqueFiltro = signal('');
  readonly dojoFiltro = signal('');
  readonly estadoFiltro = signal('');

  readonly selectedCombateId = signal<string>('');

  readonly combatesFiltrados = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.combates().filter((c) => {
      const matchesTerm =
        !term ||
        c.robot1.nombre.toLowerCase().includes(term) ||
        c.robot2.nombre.toLowerCase().includes(term);
      const matchesBloque = !this.bloqueFiltro() || c.bloque?._id === this.bloqueFiltro();
      const matchesDojo = !this.dojoFiltro() || c.dojo?._id === this.dojoFiltro();
      const matchesEstado = !this.estadoFiltro() || c.estado === this.estadoFiltro();
      return matchesTerm && matchesBloque && matchesDojo && matchesEstado;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.combatesFiltrados().length / PAGE_SIZE)),
  );

  readonly pagedCombates = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.combatesFiltrados().slice(start, start + PAGE_SIZE);
  });

  readonly selectedCombate = computed(
    () => this.combates().find((c) => c._id === this.selectedCombateId()) ?? null,
  );

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });
    this.bloqueService.findByTorneo(this.torneoId).subscribe({ next: (b) => this.bloques.set(b) });
    this.dojoService.findAll().subscribe({ next: (d) => this.dojos.set(d) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (data) => {
        this.combates.set(data);
        this.loading.set(false);
        if (data.length > 0) this.selectedCombateId.set(data[0]._id);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
  }

  onBloqueChange(value: string): void {
    this.bloqueFiltro.set(value);
    this.page.set(1);
  }

  onDojoChange(value: string): void {
    this.dojoFiltro.set(value);
    this.page.set(1);
  }

  onEstadoChange(value: string): void {
    this.estadoFiltro.set(value);
    this.page.set(1);
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.bloqueFiltro.set('');
    this.dojoFiltro.set('');
    this.estadoFiltro.set('');
    this.page.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) this.page.set(page);
  }

  selectCombate(combate: Combate): void {
    this.selectedCombateId.set(combate._id);
  }

  estadoBadgeClass(estado: EstadoCombate): string {
    switch (estado) {
      case EstadoCombate.FINALIZADO:
        return 'badge--success';
      case EstadoCombate.EN_CURSO:
        return 'badge--warning';
      default:
        return 'badge--neutral';
    }
  }

  resultadoLabel(combate: Combate): string {
    if (!combate.resultado) return '—';
    if (combate.resultado === 'Empate') return 'Empate';
    return combate.resultado === 'Gana Robot 1'
      ? `Gana ${combate.robot1.nombre}`
      : `Gana ${combate.robot2.nombre}`;
  }

  formatDuracion(segundos: number | null): string {
    if (segundos === null || segundos === undefined) return '—';
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  formatFechaHora(fecha?: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatHora(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
