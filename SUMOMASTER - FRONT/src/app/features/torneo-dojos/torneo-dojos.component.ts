import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';
import { forkJoin } from 'rxjs';

import { extractErrorMessage } from '../../core/utils/error-message.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';

import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';

import { Torneo } from '../../core/models/torneo.model';
import {
  Combate,
  FaseCombate,
} from '../../core/models/combate.model';
import {
  DojoResumen,
  EstadoDojo,
} from '../../core/models/dojo.model';

@Component({
  selector: 'app-torneo-dojos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
    RobotChipComponent,
  ],
  templateUrl:
    './torneo-dojos.component.html',
  styleUrl:
    './torneo-dojos.component.scss',
})
export class TorneoDojosComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly torneoService =
    inject(TorneoService);

  private readonly combateService =
    inject(CombateService);

  readonly torneoId =
    this.route.snapshot.paramMap.get('id') ??
    '';

  readonly FaseCombate = FaseCombate;

  readonly faseActual =
    signal<FaseCombate>(
      FaseCombate.FASE_GRUPOS,
    );

  readonly torneo =
    signal<Torneo | null>(null);

  readonly combates =
    signal<Combate[]>([]);

  readonly dojosResumen =
    signal<DojoResumen[]>([]);

  readonly selectedDojoId =
    signal<string>('');

  readonly selectedCombateId =
    signal<string>('');

  readonly searchTerm =
    signal<string>('');

  readonly sidebarOpen =
    signal(false);

  readonly loading =
    signal(false);

  readonly assigning =
    signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

  readonly combatesPendientesSinDojo =
    computed(() => {
      const termino =
        this.searchTerm()
          .trim()
          .toLowerCase();

      return this.combates().filter(
        (combate) => {
          if (combate.dojo) {
            return false;
          }

          if (!termino) {
            return true;
          }

          const robot1 =
            combate.robot1?.nombre
              ?.toLowerCase() ?? '';

          const robot2 =
            combate.robot2?.nombre
              ?.toLowerCase() ?? '';

          return (
            robot1.includes(termino) ||
            robot2.includes(termino)
          );
        },
      );
    });

  readonly combatesDelDojoSeleccionado =
    computed(() => {
      const dojoSeleccionado =
        this.selectedDojoId();

      if (!dojoSeleccionado) {
        return [];
      }

      return this.combates()
        .filter((combate) => {
          return (
            this.obtenerDojoId(
              combate,
            ) === dojoSeleccionado
          );
        })
        .sort((a, b) => {
          const diferenciaTurno =
            (a.turno ??
              Number.MAX_SAFE_INTEGER) -
            (b.turno ??
              Number.MAX_SAFE_INTEGER);

          if (diferenciaTurno !== 0) {
            return diferenciaTurno;
          }

          return (
            (a.arena ??
              Number.MAX_SAFE_INTEGER) -
            (b.arena ??
              Number.MAX_SAFE_INTEGER)
          );
        });
    });

  readonly stats = computed(() => {
    const combates =
      this.combates();

    const total =
      combates.length;

    const asignados =
      combates.filter(
        (combate) =>
          Boolean(combate.dojo),
      ).length;

    const disponibles =
      this.dojosResumen().filter(
        (resumen) =>
          resumen.dojo.estado ===
          EstadoDojo.DISPONIBLE,
      ).length;

    const ocupados =
      this.dojosResumen().filter(
        (resumen) =>
          resumen.dojo.estado ===
          EstadoDojo.OCUPADO,
      ).length;

    const mantenimiento =
      this.dojosResumen().filter(
        (resumen) =>
          resumen.dojo.estado ===
          EstadoDojo.MANTENIMIENTO,
      ).length;

    return {
      pendientes:
        total - asignados,
      asignados,
      disponibles,
      ocupados,
      mantenimiento,
    };
  });

  readonly totalTurnos = computed(() => {
    const turnos =
      this.combates()
        .map(
          (combate) =>
            combate.turno ?? 0,
        )
        .filter(
          (turno) =>
            turno > 0,
        );

    if (turnos.length === 0) {
      return 0;
    }

    return Math.max(...turnos);
  });

  ngOnInit(): void {
    this.leerFaseDesdeUrl();

    this.torneoService
      .findOne(this.torneoId)
      .subscribe({
        next: (torneo) => {
          this.torneo.set(torneo);
        },
        error: (err) => {
          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo cargar el torneo.',
            ),
          );
        },
      });

    /*
     * No cargamos los combates desde
     * TorneoFlowCacheService.
     *
     * Ese caché puede contener combates de
     * grupos, preliminar u otra fase y era
     * la causa de que reaparecieran todos.
     */
    this.load();
  }

  private leerFaseDesdeUrl(): void {
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
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      combates:
        this.combateService.findByTorneo(
          this.torneoId,
          {
            fase:
              this.faseActual(),
          },
        ),

      dojos:
        this.combateService.resumenDojos(
          this.torneoId,
          this.faseActual(),
        ),
    }).subscribe({
      next: ({
        combates,
        dojos,
      }) => {
        this.loading.set(false);

        /*
         * Siempre sustituimos el arreglo,
         * incluso si el backend devuelve [].
         * Así no permanecen combates de otra
         * fase en pantalla.
         */
        this.combates.set(combates);
        this.dojosResumen.set(dojos);

        this.validarSelecciones();
      },

      error: (err) => {
        this.loading.set(false);

        /*
         * También limpiamos la información
         * anterior para no mezclar fases.
         */
        this.combates.set([]);
        this.dojosResumen.set([]);

        this.errorMessage.set(
          extractErrorMessage(
            err,
            `No se pudo cargar la asignación de la fase "${this.faseActual()}".`,
          ),
        );
      },
    });
  }

  loadResumenDojos(): void {
    this.combateService
      .resumenDojos(
        this.torneoId,
        this.faseActual(),
      )
      .subscribe({
        next: (data) => {
          this.dojosResumen.set(data);
          this.validarDojoSeleccionado();
        },

        error: (err) => {
          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo actualizar el resumen de los dojos.',
            ),
          );
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
    const combateId =
      this.selectedCombateId();

    const dojoId =
      this.selectedDojoId();

    if (!combateId || !dojoId) {
      return;
    }

    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService
      .asignarDojo(
        combateId,
        dojoId,
      )
      .subscribe({
        next: (actualizado) => {
          this.assigning.set(false);
          this.selectedCombateId.set('');

          this.patchCombate(
            actualizado,
          );

          this.successMessage.set(
            'El combate fue asignado correctamente.',
          );

          this.loadResumenDojos();
        },

        error: (err) => {
          this.assigning.set(false);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo asignar el combate.',
            ),
          );
        },
      });
  }

  quitarAsignacion(
    combateId: string,
  ): void {
    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService
      .quitarDojo(combateId)
      .subscribe({
        next: (actualizado) => {
          this.assigning.set(false);

          this.patchCombate(
            actualizado,
          );

          this.successMessage.set(
            'La asignación fue eliminada.',
          );

          this.loadResumenDojos();
        },

        error: (err) => {
          this.assigning.set(false);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo quitar la asignación.',
            ),
          );
        },
      });
  }

  asignarAutomaticamente(): void {
    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService
      .asignarDojosAutomatico(
        this.torneoId,
        this.faseActual(),
      )
      .subscribe({
        next: (actualizados) => {
          this.assigning.set(false);

          /*
           * El backend debe devolver solamente
           * los combates de la fase solicitada.
           */
          this.combates.set(
            actualizados ?? [],
          );

          this.selectedCombateId.set('');

          this.successMessage.set(
            `${actualizados?.length ?? 0} combates de "${this.faseActual()}" fueron organizados automáticamente.`,
          );

          this.loadResumenDojos();
        },

        error: (err) => {
          this.assigning.set(false);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudieron asignar los combates automáticamente.',
            ),
          );
        },
      });
  }

  limpiarAsignaciones(): void {
    const asignados =
      this.combates().filter(
        (combate) =>
          Boolean(combate.dojo),
      );

    if (asignados.length === 0) {
      return;
    }

    const confirmado =
      window.confirm(
        `Se quitarán las asignaciones de ${asignados.length} combates de "${this.faseActual()}". ¿Deseas continuar?`,
      );

    if (!confirmado) {
      return;
    }

    this.assigning.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    forkJoin(
      asignados.map(
        (combate) =>
          this.combateService.quitarDojo(
            combate._id,
          ),
      ),
    ).subscribe({
      next: () => {
        this.assigning.set(false);

        this.selectedCombateId.set('');

        this.successMessage.set(
          'Las asignaciones de la fase fueron eliminadas.',
        );

        this.load();
      },

      error: (err) => {
        this.assigning.set(false);

        this.errorMessage.set(
          extractErrorMessage(
            err,
            'No se pudieron limpiar todas las asignaciones.',
          ),
        );

        this.load();
      },
    });
  }

  cantidadCombatesDojo(
    dojoId: string,
  ): number {
    return this.combates().filter(
      (combate) =>
        this.obtenerDojoId(
          combate,
        ) === dojoId,
    ).length;
  }

  dojoEstadoClass(
    estado: EstadoDojo,
  ): string {
    switch (estado) {
      case EstadoDojo.DISPONIBLE:
        return 'badge--success';

      case EstadoDojo.OCUPADO:
        return 'badge--warning';

      default:
        return 'badge--neutral';
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(
      (abierto) => !abierto,
    );
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private patchCombate(
    actualizado: Combate,
  ): void {
    /*
     * Como esta vista ya contiene únicamente
     * la fase actual, modificamos solamente
     * el combate recibido.
     */
    this.combates.update(
      (lista) =>
        lista.map(
          (combate) =>
            combate._id ===
            actualizado._id
              ? actualizado
              : combate,
        ),
    );
  }

  private obtenerDojoId(
    combate: Combate,
  ): string {
    const dojo =
      combate.dojo;

    if (!dojo) {
      return '';
    }

    return typeof dojo === 'string'
      ? dojo
      : dojo._id;
  }

  private validarSelecciones(): void {
    const combateSeleccionadoExiste =
      this.combates().some(
        (combate) =>
          combate._id ===
          this.selectedCombateId(),
      );

    if (!combateSeleccionadoExiste) {
      this.selectedCombateId.set('');
    }

    this.validarDojoSeleccionado();
  }

  private validarDojoSeleccionado(): void {
    const dojoSeleccionadoExiste =
      this.dojosResumen().some(
        (resumen) =>
          resumen.dojo._id ===
          this.selectedDojoId(),
      );

    if (dojoSeleccionadoExiste) {
      return;
    }

    const primerDojo =
      this.dojosResumen()[0];

    this.selectedDojoId.set(
      primerDojo?.dojo._id ?? '',
    );
  }
}