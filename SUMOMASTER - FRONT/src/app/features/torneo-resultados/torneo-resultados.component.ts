import { extractErrorMessage } from '../../core/utils/error-message.util';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';
import { DojoResumen } from '../../core/models/dojo.model';
import { Torneo } from '../../core/models/torneo.model';
import {
  Combate,
  EstadoCombate,
  MetodoVictoria,
  ResultadoCombate,
  FaseCombate
} from '../../core/models/combate.model';

import { RankingService } from '../../core/services/ranking.service';


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

  private readonly router = inject(Router);

private readonly rankingService =
  inject(RankingService);

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
  readonly dojosResumen = signal<DojoResumen[]>([]);
readonly dojoFiltro = signal<string>('');
readonly arenaFiltro = signal<number | null>(null);

  readonly saving = signal(false);
  readonly starting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly FaseCombate = FaseCombate;

  readonly errorMessage = signal<string | null>(null);
readonly successMessage = signal<string | null>(null);


  readonly generandoSiguienteRonda =
  signal(false);

readonly siguienteRondaError =
  signal<string | null>(null);

readonly faseActual =
  signal<FaseCombate>(
    FaseCombate.FASE_GRUPOS,
  );

  readonly arenasDisponibles = computed(() => {
  const dojo = this.dojosResumen().find(
    (item) => item.dojo._id === this.dojoFiltro(),
  );

  const capacidad = dojo?.dojo.capacidad ?? 0;

  return Array.from(
    { length: capacidad },
    (_, index) => index + 1,
  );
});

readonly combatesDelPuesto = computed(() => {
  const dojoId = this.dojoFiltro();
  const arena = this.arenaFiltro();

  // Obliga al juez a seleccionar primero su dojo.
  if (!dojoId) {
    return [];
  }

  return this.combates().filter((combate) => {
    const coincideDojo =
      combate.dojo?._id === dojoId;

    const coincideArena =
      arena === null ||
      combate.arena === arena;

    return coincideDojo && coincideArena;
  });
});

readonly combatesFiltrados = computed(() =>
  this.combatesDelPuesto()
    .filter(
      (combate) =>
        combate.estado === this.activeTab(),
    )
    .sort((a, b) => {
      const diferenciaTurno =
        (a.turno ?? Number.MAX_SAFE_INTEGER) -
        (b.turno ?? Number.MAX_SAFE_INTEGER);

      if (diferenciaTurno !== 0) {
        return diferenciaTurno;
      }

      const diferenciaArena =
        (a.arena ?? Number.MAX_SAFE_INTEGER) -
        (b.arena ?? Number.MAX_SAFE_INTEGER);

      if (diferenciaArena !== 0) {
        return diferenciaArena;
      }

      return a.numero - b.numero;
    }),
);

  readonly countByEstado = computed(() => {
  const combates = this.combatesDelPuesto();

  return {
    Pendiente: combates.filter(
      (combate) =>
        combate.estado === EstadoCombate.PENDIENTE,
    ).length,

    'En curso': combates.filter(
      (combate) =>
        combate.estado === EstadoCombate.EN_CURSO,
    ).length,

    Finalizado: combates.filter(
      (combate) =>
        combate.estado === EstadoCombate.FINALIZADO,
    ).length,
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

  readonly generatingRandomResults = signal(false);

  ngOnInit(): void {
    const faseUrl =
    this.route.snapshot.queryParamMap.get(
      'fase',
    );

  if (
    faseUrl &&
    Object.values(FaseCombate).includes(
      faseUrl as FaseCombate,
    )
  ) {
    this.faseActual.set(
      faseUrl as FaseCombate,
    );
  }
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });

    

    this.loadDojos();

    this.load();
  }

  load(): void {
  this.loading.set(true);
  this.formError.set(null);

  this.combateService
    .findByTorneo(
      this.torneoId,
      {
        fase: this.faseActual(),
      },
    )
    .subscribe({
      next: (data) => {
        this.loading.set(false);

        /*
         * Sustituimos siempre la lista.
         * No conservamos combates de otra fase.
         */
        this.combates.set(data);

        const seleccionadoExiste =
          data.some(
            (combate) =>
              combate._id ===
              this.selectedCombateId(),
          );

        if (!seleccionadoExiste) {
          this.selectedCombateId.set('');
        }
      },

      error: (err) => {
        this.loading.set(false);
        this.combates.set([]);

        this.formError.set(
          extractErrorMessage(
            err,
            `No se pudieron cargar los combates de "${this.faseActual()}".`,
          ),
        );
      },
    });
}

  setTab(tab: TabEstado): void {
  this.activeTab.set(tab);
  this.selectedCombateId.set('');
  this.formError.set(null);
}


continuarSiguienteRonda(): void {
  const faseActual = this.faseActual();

  if (!faseActual) {
    this.errorMessage.set(
      'No se pudo determinar la fase actual.',
    );
    return;
  }

  this.generandoSiguienteRonda.set(true);
  this.errorMessage.set(null);
  this.successMessage.set(null);

  this.rankingService
    .generarSiguienteRonda(
      this.torneoId,
      faseActual,
    )
    .subscribe({
      next: (respuesta) => {
        this.generandoSiguienteRonda.set(false);

        this.router.navigate(
          [
            '/torneos',
            this.torneoId,
            'enfrentamientos',
          ],
          {
            queryParams: {
              fase: respuesta.siguienteFase,
            },
          },
        );
      },
      error: (err) => {
        this.generandoSiguienteRonda.set(false);

        this.errorMessage.set(
          extractErrorMessage(
            err,
            'No se pudo generar la siguiente ronda.',
          ),
        );
      },
    });
}

generarResultadosPrueba(): void {
  const confirmado =
    window.confirm(
      `Se generarán resultados aleatorios únicamente para los combates pendientes de "${this.faseActual()}". ¿Deseas continuar?`,
    );

  if (!confirmado) {
    return;
  }

  this.saving.set(true);
  this.formError.set(null);
  this.successMessage.set(null);

  this.combateService
    .registrarResultadosAleatorios(
      this.torneoId,
      this.faseActual(),
    )
    .subscribe({
      next: (respuesta) => {
  this.saving.set(false);
  this.selectedCombateId.set('');

  if (
    respuesta.actualizados > 0
  ) {
    this.activeTab.set(
      'Finalizado',
    );

    this.successMessage.set(
      `${respuesta.actualizados} resultados de "${this.faseActual()}" fueron registrados.`,
    );
  } else {
    this.activeTab.set(
      'Pendiente',
    );

    this.successMessage.set(
      `No se encontraron combates pendientes para actualizar en "${this.faseActual()}".`,
    );
  }

  this.load();
},

      error: (err) => {
        this.saving.set(false);

        this.formError.set(
          extractErrorMessage(
            err,
            'No se pudieron generar los resultados de prueba.',
          ),
        );
      },
    });
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

  loadDojos(): void {
  this.combateService
    .resumenDojos(this.torneoId)
    .subscribe({
      next: (data) => {
        this.dojosResumen.set(data);
      },
      error: (err) => {
        this.formError.set(
          extractErrorMessage(
            err,
            'No se pudieron cargar los dojos.',
          ),
        );
      },
    });
}

cambiarDojo(dojoId: string): void {
  this.dojoFiltro.set(dojoId);
  this.arenaFiltro.set(null);
  this.selectedCombateId.set('');
  this.formError.set(null);
}

cambiarArena(value: string): void {
  this.arenaFiltro.set(
    value ? Number(value) : null,
  );

  this.selectedCombateId.set('');
  this.formError.set(null);
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
            extractErrorMessage(err, 'No se pudo guardar el resultado.'),
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

  equipoNombre(robot: Combate['robot1']): string {
    const equipo = robot?.equipo;
    if (!equipo) return '';
    return typeof equipo === 'string' ? equipo : equipo.nombre;
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
