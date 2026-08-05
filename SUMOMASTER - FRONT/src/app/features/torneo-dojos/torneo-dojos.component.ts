import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';
import { Torneo } from '../../core/models/torneo.model';
import { Combate } from '../../core/models/combate.model';
import { DojoResumen, EstadoDojo } from '../../core/models/dojo.model';

@Component({
  selector: 'app-torneo-dojos',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent, RobotChipComponent],
  templateUrl: './torneo-dojos.component.html',
  styleUrl: './torneo-dojos.component.scss',
})
export class TorneoDojosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
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

  readonly combates = signal<Combate[]>([]);
  readonly dojosResumen = signal<DojoResumen[]>([]);
  readonly selectedDojoId = signal<string>('');
  readonly selectedCombateId = signal<string>('');
  readonly searchTerm = signal('');

  readonly loading = signal(false);
  readonly assigning = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly combatesPendientesSinDojo = computed(() =>
    this.combates().filter(
      (c) =>
        !c.dojo &&
        (!this.searchTerm() ||
          c.robot1.nombre.toLowerCase().includes(this.searchTerm().toLowerCase()) ||
          c.robot2.nombre.toLowerCase().includes(this.searchTerm().toLowerCase())),
    ),
  );

  readonly combatesDelDojoSeleccionado = computed(() =>
    this.combates().filter((c) => c.dojo?._id === this.selectedDojoId()),
  );

  readonly stats = computed(() => {
    const total = this.combates().length;
    const asignados = this.combates().filter((c) => c.dojo).length;
    const disponibles = this.dojosResumen().filter(
      (d) => d.dojo.estado === EstadoDojo.DISPONIBLE,
    ).length;
    const ocupados = this.dojosResumen().filter(
      (d) => d.dojo.estado === EstadoDojo.OCUPADO,
    ).length;
    const mantenimiento = this.dojosResumen().filter(
      (d) => d.dojo.estado === EstadoDojo.MANTENIMIENTO,
    ).length;

    return {
      pendientes: total - asignados,
      asignados,
      disponibles,
      ocupados,
      mantenimiento,
    };
  });

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.combateService.findByTorneo(this.torneoId).subscribe({
      next: (data) => {
        this.combates.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.combateService.resumenDojos(this.torneoId).subscribe({
      next: (data) => {
        this.dojosResumen.set(data);
        if (!this.selectedDojoId() && data.length > 0) {
          this.selectedDojoId.set(data[0].dojo._id);
        }
      },
    });
  }

  selectDojo(id: string): void {
    this.selectedDojoId.set(id);
  }

  selectCombate(id: string): void {
    this.selectedCombateId.set(id);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  asignarSeleccionado(): void {
    if (!this.selectedCombateId() || !this.selectedDojoId()) return;

    this.assigning.set(true);
    this.errorMessage.set(null);

    this.combateService.asignarDojo(this.selectedCombateId(), this.selectedDojoId()).subscribe({
      next: () => {
        this.assigning.set(false);
        this.selectedCombateId.set('');
        this.load();
      },
      error: (err) => {
        this.assigning.set(false);
        this.errorMessage.set(err?.error?.message ?? 'No se pudo asignar el combate.');
      },
    });
  }

  quitarAsignacion(combateId: string): void {
    this.combateService.quitarDojo(combateId).subscribe({ next: () => this.load() });
  }

  asignarAutomaticamente(): void {
    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService.asignarDojosAutomatico(this.torneoId).subscribe({
      next: () => {
        this.assigning.set(false);
        this.successMessage.set('Combates asignados automáticamente.');
        this.load();
      },
      error: (err) => {
        this.assigning.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'No se pudieron asignar los combates automáticamente.',
        );
      },
    });
  }

  limpiarAsignaciones(): void {
    const asignados = this.combates().filter((c) => c.dojo);
    if (asignados.length === 0) return;

    this.assigning.set(true);
    Promise.all(
      asignados.map((c) => this.combateService.quitarDojo(c._id).toPromise()),
    ).finally(() => {
      this.assigning.set(false);
      this.load();
    });
  }

  dojoEstadoClass(estado: EstadoDojo): string {
    switch (estado) {
      case EstadoDojo.DISPONIBLE:
        return 'badge--success';
      case EstadoDojo.OCUPADO:
        return 'badge--warning';
      default:
        return 'badge--neutral';
    }
  }
}
