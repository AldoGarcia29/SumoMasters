import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';
import { Torneo } from '../../core/models/torneo.model';
import {
  Combate,
  EstadoCombate,
  MetodoVictoria,
  ResultadoCombate,
} from '../../core/models/combate.model';

type TabEstado = 'Pendiente' | 'En curso' | 'Finalizado';

@Component({
  selector: 'app-torneo-resultados',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
    RobotChipComponent,
  ],
  templateUrl: './torneo-resultados.component.html',
  styleUrl: './torneo-resultados.component.scss',
})
export class TorneoResultadosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly combateService = inject(CombateService);
  private readonly fb = inject(FormBuilder);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly ResultadoCombate = ResultadoCombate;
  readonly metodosVictoria = Object.values(MetodoVictoria);

  readonly torneoId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly torneo = signal<Torneo | null>(null);
  readonly combates = signal<Combate[]>([]);
  readonly loading = signal(false);

  readonly activeTab = signal<TabEstado>('Pendiente');
  readonly selectedCombateId = signal<string>('');

  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly combatesFiltrados = computed(() =>
    this.combates().filter((c) => c.estado === this.activeTab()),
  );

  readonly countByEstado = computed(() => {
    const combates = this.combates();
    return {
      Pendiente: combates.filter((c) => c.estado === EstadoCombate.PENDIENTE).length,
      'En curso': combates.filter((c) => c.estado === EstadoCombate.EN_CURSO).length,
      Finalizado: combates.filter((c) => c.estado === EstadoCombate.FINALIZADO).length,
    };
  });

  readonly selectedCombate = computed(() =>
    this.combates().find((c) => c._id === this.selectedCombateId()) ?? null,
  );

  readonly form = this.fb.nonNullable.group({
    resultado: this.fb.control<ResultadoCombate | null>(null, Validators.required),
    metodoVictoria: this.fb.control<MetodoVictoria | null>(null),
    tiempo: [''],
    jueces: [''],
    observaciones: [''],
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
  }

  setTab(tab: TabEstado): void {
    this.activeTab.set(tab);
  }

  selectCombate(combate: Combate): void {
    this.selectedCombateId.set(combate._id);
    this.formError.set(null);
    this.form.reset({
      resultado: combate.resultado,
      metodoVictoria: combate.metodoVictoria,
      tiempo: this.formatSegundos(combate.duracionSegundos),
      jueces: combate.jueces.join(', '),
      observaciones: combate.observaciones,
    });
  }

  registrar(combate: Combate): void {
    this.starting.set(true);
    this.combateService.iniciar(combate._id).subscribe({
      next: (actualizado) => {
        this.starting.set(false);
        this.replaceCombate(actualizado);
        this.selectCombate(actualizado);
        this.activeTab.set('En curso');
      },
      error: () => {
        this.starting.set(false);
      },
    });
  }

  submitResultado(): void {
    const combate = this.selectedCombate();
    if (!combate || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const duracionSegundos = this.parseTiempo(raw.tiempo);

    this.saving.set(true);
    this.formError.set(null);

    this.combateService
      .registrarResultado(combate._id, {
        resultado: raw.resultado as ResultadoCombate,
        metodoVictoria: raw.metodoVictoria ?? undefined,
        duracionSegundos: duracionSegundos ?? undefined,
        jueces: raw.jueces
          ? raw.jueces.split(',').map((j) => j.trim()).filter(Boolean)
          : [],
        observaciones: raw.observaciones || '',
      })
      .subscribe({
        next: (actualizado) => {
          this.saving.set(false);
          this.replaceCombate(actualizado);
          this.selectCombate(actualizado);
          this.activeTab.set('Finalizado');
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(
            err?.error?.message ?? 'No se pudo guardar el resultado.',
          );
        },
      });
  }

  cancelarCombate(): void {
    const combate = this.selectedCombate();
    if (!combate) return;

    this.combateService.cancelar(combate._id).subscribe({
      next: (actualizado) => {
        this.replaceCombate(actualizado);
        this.selectedCombateId.set('');
        this.activeTab.set('Pendiente');
      },
    });
  }

  private replaceCombate(actualizado: Combate): void {
    this.combates.update((lista) =>
      lista.map((c) => (c._id === actualizado._id ? actualizado : c)),
    );
  }

  private parseTiempo(value: string): number | null {
    const match = value?.trim().match(/^(\d+):([0-5]?\d)$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  formatSegundos(segundos: number | null): string {
    if (segundos === null || segundos === undefined) return '';
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  estadoBadgeClass(estado: EstadoCombate): string {
    switch (estado) {
      case EstadoCombate.PENDIENTE:
        return 'badge--neutral';
      case EstadoCombate.EN_CURSO:
        return 'badge--warning';
      default:
        return 'badge--success';
    }
  }

  formatHora(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
