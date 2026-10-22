import { Role } from '../../core/models/auth.model';
import { forkJoin } from 'rxjs';
import { AsignacionesStaffService } from '../../core/services/asignaciones-staff.service';
import { DojoService } from '../../core/services/dojo.service';
import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';

import { extractErrorMessage } from '../../core/utils/error-message.util';

import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';

import { TorneoService } from '../../core/services/torneo.service';
import { CombateService } from '../../core/services/combate.service';
import { AuthService } from '../../core/services/auth.service';
import { RankingService } from '../../core/services/ranking.service';
import { TorneoFlowCacheService } from '../../core/services/torneo-flow-cache.service';

import { DojoResumen } from '../../core/models/dojo.model';
import { Torneo } from '../../core/models/torneo.model';

import {
  Combate,
  EstadoCombate,
  MetodoVictoria,
  ResultadoCombate,
  FaseCombate,
} from '../../core/models/combate.model';

import { CanDirective } from '../../shared/directives/can.directive';

type TabEstado =
  | 'Pendiente'
  | 'En curso'
  | 'Finalizado';

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
    CanDirective,
  ],

  templateUrl:
    './torneo-resultados.component.html',

  styleUrl:
    './torneo-resultados.component.scss',
})
export class TorneoResultadosComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly torneoService =
    inject(TorneoService);

  private readonly combateService =
    inject(CombateService);

  private readonly flowCache =
    inject(TorneoFlowCacheService);

  private readonly fb =
    inject(FormBuilder);

  private readonly router =
    inject(Router);

  private readonly rankingService =
    inject(RankingService);

  private readonly asignacionesService = inject(AsignacionesStaffService);
  private readonly dojoService = inject(DojoService);

  /** Dojos asignados al STAFF para hoy en este torneo. */
  readonly dojosAsignados = signal<{ _id: string; nombre: string }[]>([]);
  readonly staffSinAsignacion = signal(false);

  /**
   * ADMIN y STAFF pueden iniciar
   * combates y registrar resultados.
   */
  private readonly auth = inject(AuthService);
  readonly canManage = this.auth.canManage;
  get isStaffOnly(): boolean {
    return this.auth.hasAnyRole([Role.STAFF]) && !this.auth.hasAnyRole([Role.ADMIN]);
  }

  // =========================
  // SIDEBAR
  // =========================

  readonly sidebarOpen =
    signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update(
      (value) => !value,
    );
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  // =========================
  // ENUMS
  // =========================

  readonly ResultadoCombate =
    ResultadoCombate;

  readonly FaseCombate =
    FaseCombate;

  readonly metodosVictoria =
    Object.values(MetodoVictoria);

  // =========================
  // TORNEO
  // =========================

  readonly torneoId =
    this.route.snapshot.paramMap.get(
      'id',
    ) ?? '';

  readonly torneo =
    signal<Torneo | null>(null);

  // =========================
  // COMBATES
  // =========================

  readonly combates =
    signal<Combate[]>([]);

  readonly loading =
    signal(false);

  readonly activeTab =
    signal<TabEstado>(
      'Pendiente',
    );

  readonly selectedCombateId =
    signal<string>('');

  // =========================
  // DOJOS
  // =========================

  readonly dojosResumen =
    signal<DojoResumen[]>([]);

  readonly dojoFiltro =
    signal<string>('');

  readonly arenaFiltro =
    signal<number | null>(
      null,
    );

  // =========================
  // ESTADOS DE UI
  // =========================

  readonly saving =
    signal(false);

  readonly starting =
    signal(false);

  readonly formError =
    signal<string | null>(
      null,
    );

  readonly errorMessage =
    signal<string | null>(
      null,
    );

  readonly successMessage =
    signal<string | null>(
      null,
    );

  // =========================
  // SIGUIENTE RONDA
  // =========================

  readonly generandoSiguienteRonda =
    signal(false);

  readonly siguienteRondaError =
    signal<string | null>(
      null,
    );

  readonly faseActual =
    signal<FaseCombate>(
      FaseCombate.FASE_GRUPOS,
    );

  // =========================
  // ARENAS DEL DOJO
  // =========================

  readonly arenasDisponibles =
    computed(() => {
      const dojo =
        this.dojosResumen().find(
          (item) =>
            item.dojo._id ===
            this.dojoFiltro(),
        );

      const capacidad =
        dojo?.dojo.capacidad ?? 0;

      return Array.from(
        {
          length: capacidad,
        },
        (_, index) =>
          index + 1,
      );
    });

  // =========================
  // COMBATES DEL DOJO
  // =========================

  readonly combatesDelPuesto =
    computed(() => {
      const dojoId =
        this.dojoFiltro();

      const arena =
        this.arenaFiltro();

      /*
       * El STAFF/Juez debe
       * seleccionar un dojo
       * antes de visualizar
       * los combates.
       */
      if (!dojoId) {
        return [];
      }

      return this.combates().filter(
        (combate) => {
          const coincideDojo =
            combate.dojo?._id ===
            dojoId;

          const coincideArena =
            arena === null ||
            combate.arena ===
              arena;

          return (
            coincideDojo &&
            coincideArena
          );
        },
      );
    });

  // =========================
  // COMBATES FILTRADOS
  // =========================

  readonly combatesFiltrados =
    computed(() =>
      this.combatesDelPuesto()
        .filter(
          (combate) =>
            combate.estado ===
            this.activeTab(),
        )
        .sort((a, b) => {
          const diferenciaTurno =
            (a.turno ??
              Number.MAX_SAFE_INTEGER) -
            (b.turno ??
              Number.MAX_SAFE_INTEGER);

          if (
            diferenciaTurno !== 0
          ) {
            return diferenciaTurno;
          }

          const diferenciaArena =
            (a.arena ??
              Number.MAX_SAFE_INTEGER) -
            (b.arena ??
              Number.MAX_SAFE_INTEGER);

          if (
            diferenciaArena !== 0
          ) {
            return diferenciaArena;
          }

          return (
            a.numero -
            b.numero
          );
        }),
    );

  // =========================
  // CONTADORES
  // =========================

  readonly countByEstado =
    computed(() => {
      const combates =
        this.combatesDelPuesto();

      return {
        Pendiente:
          combates.filter(
            (combate) =>
              combate.estado ===
              EstadoCombate.PENDIENTE,
          ).length,

        'En curso':
          combates.filter(
            (combate) =>
              combate.estado ===
              EstadoCombate.EN_CURSO,
          ).length,

        Finalizado:
          combates.filter(
            (combate) =>
              combate.estado ===
              EstadoCombate.FINALIZADO,
          ).length,
      };
    });

  // =========================
  // COMBATE SELECCIONADO
  // =========================

  readonly selectedCombate =
    computed(
      () =>
        this.combates().find(
          (combate) =>
            combate._id ===
            this.selectedCombateId(),
        ) ?? null,
    );

  // =========================
  // FORMULARIO
  // =========================

  readonly form =
    this.fb.nonNullable.group({
      resultado:
        this.fb.control<
          ResultadoCombate | null
        >(
          null,
          Validators.required,
        ),

      metodoVictoria:
        this.fb.control<
          MetodoVictoria | null
        >(null, Validators.required),

      otroMetodoVictoria: [''],

      tiempo: [''],

      jueces: [''],

      observaciones: [''],
    });

  readonly generatingRandomResults =
    signal(false);

  // =========================
  // INIT
  // =========================

  ngOnInit(): void {
    if (this.isStaffOnly) {
      const dojoUrl = this.route.snapshot.queryParamMap.get('dojo');
      if (dojoUrl) this.dojoFiltro.set(dojoUrl);
      this.cargarDojosAsignados();
    }
    const faseUrl =
      this.route.snapshot
        .queryParamMap
        .get('fase');

    if (
      faseUrl &&
      Object.values(
        FaseCombate,
      ).includes(
        faseUrl as FaseCombate,
      )
    ) {
      this.faseActual.set(
        faseUrl as FaseCombate,
      );
    }

    this.torneoService
      .findOne(this.torneoId)
      .subscribe({
        next: (torneo) => {
          this.torneo.set(
            torneo,
          );
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

    this.loadDojos();

    this.load();
  }

  // =========================
  // DOJO ASIGNADO (STAFF)
  // =========================

  /**
   * El STAFF no elige dojo: se toma de sus asignaciones de hoy
   * para este torneo y solo ve los combates de ese dojo.
   */
  private cargarDojosAsignados(): void {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    forkJoin({
      asignaciones: this.asignacionesService.mias(),
      dojos: this.dojoService.findAll(),
    }).subscribe({
      next: ({ asignaciones, dojos }) => {
        const ids = new Set(
          asignaciones.filter(a => a.torneo === this.torneoId && a.fecha === hoy).map(a => a.dojo),
        );
        const lista = dojos
          .filter(d => ids.has(d._id))
          .map(d => ({ _id: d._id, nombre: d.nombre }));
        this.dojosAsignados.set(lista);
        this.staffSinAsignacion.set(lista.length === 0);
        if (lista.length && !lista.some(d => d._id === this.dojoFiltro())) {
          this.dojoFiltro.set(lista[0]._id);
        }
      },
      error: () => this.formError.set('No se pudieron cargar tus asignaciones de dojo.'),
    });
  }

  // =========================
  // CARGAR COMBATES
  // =========================

  load(): void {
    this.loading.set(true);

    this.formError.set(
      null,
    );

    this.combateService
      .findByTorneo(
        this.torneoId,
        {
          fase:
            this.faseActual(),
        },
      )
      .subscribe({
        next: (data) => {
          this.loading.set(
            false,
          );

          /*
           * Sustituimos siempre
           * la lista completa.
           */
          this.combates.set(
            data,
          );
          if (this.isStaffOnly) {
            const resumen = new Map<string, DojoResumen>();
            for (const combate of data) {
              if (!combate.dojo) continue;
              const dojo = combate.dojo;
              const previo = resumen.get(dojo._id);
              if (previo) previo.combatesAsignados++;
              else resumen.set(dojo._id, { dojo, combatesAsignados: 1 });
            }
            this.dojosResumen.set([...resumen.values()]);
          }

          const seleccionadoExiste =
            data.some(
              (combate) =>
                combate._id ===
                this.selectedCombateId(),
            );

          if (
            !seleccionadoExiste
          ) {
            this.selectedCombateId.set(
              '',
            );
          }
        },

        error: (err) => {
          this.loading.set(
            false,
          );

          this.combates.set(
            [],
          );

          this.formError.set(
            extractErrorMessage(
              err,
              `No se pudieron cargar los combates de "${this.faseActual()}".`,
            ),
          );
        },
      });
  }

  // =========================
  // CAMBIAR TAB
  // =========================

  setTab(
    tab: TabEstado,
  ): void {
    this.activeTab.set(
      tab,
    );

    this.selectedCombateId.set(
      '',
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );
  }

  // =========================
  // SIGUIENTE RONDA
  // =========================

  continuarSiguienteRonda(): void {
    const faseActual =
      this.faseActual();

    if (!faseActual) {
      this.errorMessage.set(
        'No se pudo determinar la fase actual.',
      );

      return;
    }

    this.generandoSiguienteRonda.set(
      true,
    );

    this.errorMessage.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    this.rankingService
      .generarSiguienteRonda(
        this.torneoId,
        faseActual,
      )
      .subscribe({
        next: (
          respuesta,
        ) => {
          this.generandoSiguienteRonda.set(
            false,
          );

          this.router.navigate(
            [
              '/torneos',
              this.torneoId,
              'enfrentamientos',
            ],
            {
              queryParams: {
                fase:
                  respuesta.siguienteFase,
              },
            },
          );
        },

        error: (err) => {
          this.generandoSiguienteRonda.set(
            false,
          );

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo generar la siguiente ronda.',
            ),
          );
        },
      });
  }

  // =========================
  // RESULTADOS DE PRUEBA
  // =========================

  generarResultadosPrueba(): void {
    const confirmado =
      window.confirm(
        `Se generarán resultados aleatorios únicamente para los combates pendientes de "${this.faseActual()}". ¿Deseas continuar?`,
      );

    if (!confirmado) {
      return;
    }

    this.saving.set(
      true,
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    this.combateService
      .registrarResultadosAleatorios(
        this.torneoId,
        this.faseActual(),
      )
      .subscribe({
        next: (
          respuesta,
        ) => {
          this.saving.set(
            false,
          );

          this.selectedCombateId.set(
            '',
          );

          if (
            respuesta.actualizados >
            0
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
          this.saving.set(
            false,
          );

          this.formError.set(
            extractErrorMessage(
              err,
              'No se pudieron generar los resultados de prueba.',
            ),
          );
        },
      });
  }

  // =========================
  // SELECCIONAR COMBATE
  // =========================

  selectCombate(
    combate: Combate,
  ): void {
    this.selectedCombateId.set(
      combate._id,
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    this.form.reset({
      resultado:
        combate.resultado,

      metodoVictoria:
        combate.metodoVictoria,

      otroMetodoVictoria: combate.otroMetodoVictoria ?? '',

      tiempo:
        this.formatSegundos(
          combate.duracionSegundos,
        ),

      jueces:
        combate.jueces.join(
          ', ',
        ),

      observaciones:
        combate.observaciones,
    });
  }

  // =========================
  // INICIAR / REGISTRAR COMBATE
  // =========================

  registrar(
    combate: Combate,
  ): void {
    this.starting.set(
      true,
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    this.combateService
      .iniciar(
        combate._id,
      )
      .subscribe({
        next: (
          actualizado,
        ) => {
          this.starting.set(
            false,
          );

          this.replaceCombate(
            actualizado,
          );

          this.selectCombate(
            actualizado,
          );

          this.activeTab.set(
            'En curso',
          );
        },

        error: (err) => {
          this.starting.set(
            false,
          );

          this.formError.set(
            extractErrorMessage(
              err,
              'No se pudo iniciar el combate.',
            ),
          );
        },
      });
  }

  // =========================
  // DOJOS
  // =========================

  loadDojos(): void {
    // STAFF obtiene los dojos exclusivamente de sus combates autorizados.
    if (this.isStaffOnly) return;
    this.combateService
      .resumenDojos(
        this.torneoId,
      )
      .subscribe({
        next: (data) => {
          this.dojosResumen.set(
            data,
          );
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

  cambiarDojo(
    dojoId: string,
  ): void {
    this.dojoFiltro.set(
      dojoId,
    );

    this.arenaFiltro.set(
      null,
    );

    this.selectedCombateId.set(
      '',
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    this.activeTab.set(
      'Pendiente',
    );
  }

  cambiarArena(
    value: string,
  ): void {
    this.arenaFiltro.set(
      value
        ? Number(value)
        : null,
    );

    this.selectedCombateId.set(
      '',
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );
  }

  // =========================
  // GUARDAR RESULTADO
  // =========================

  submitResultado(): void {
    const combate =
      this.selectedCombate();

    if (
      !combate ||
      this.form.invalid
    ) {
      this.form.markAllAsTouched();

      return;
    }

    const raw =
      this.form.getRawValue();

    if (raw.metodoVictoria === MetodoVictoria.OTRO && !raw.otroMetodoVictoria.trim()) {
      this.formError.set('Escribe el método de victoria en el campo Otro.');
      this.form.controls.otroMetodoVictoria.markAsTouched();
      return;
    }

    // =========================
    // NOMBRE DEL GANADOR
    // =========================

    let ganador =
      'Empate';

    if (
      raw.resultado ===
      ResultadoCombate.GANA_ROBOT_1
    ) {
      ganador =
        combate.robot1.nombre;
    }

    if (
      raw.resultado ===
      ResultadoCombate.GANA_ROBOT_2
    ) {
      ganador =
        combate.robot2.nombre;
    }

    // =========================
    // CONFIRMACIÓN
    // =========================

    const confirmado =
      window.confirm(
        `¿Deseas registrar este combate?\n\nResultado: ${ganador}`,
      );

    if (!confirmado) {
      return;
    }

    const duracionSegundos =
      this.parseTiempo(
        raw.tiempo,
      );

    this.saving.set(
      true,
    );

    this.formError.set(
      null,
    );

    this.successMessage.set(
      null,
    );

    // =========================
    // GUARDAR EN BACKEND
    // =========================

    this.combateService
      .registrarResultado(
        combate._id,
        {
          resultado:
            raw.resultado as ResultadoCombate,

          metodoVictoria: raw.metodoVictoria as MetodoVictoria,
          otroMetodoVictoria: raw.metodoVictoria === MetodoVictoria.OTRO
            ? raw.otroMetodoVictoria.trim() : undefined,

          duracionSegundos:
            duracionSegundos ??
            undefined,

          jueces:
            raw.jueces
              ? raw.jueces
                  .split(',')
                  .map(
                    (juez) =>
                      juez.trim(),
                  )
                  .filter(
                    Boolean,
                  )
              : [],

          observaciones:
            raw.observaciones ||
            '',
        },
      )
      .subscribe({
        next: () => {
          this.saving.set(
            false,
          );

          /*
           * Quitamos el formulario
           * del combate registrado.
           */
          this.selectedCombateId.set(
            '',
          );

          /*
           * Volvemos a la lista
           * de combates pendientes.
           */
          this.activeTab.set(
            'Pendiente',
          );

          /*
           * Limpiamos el formulario.
           */
          this.form.reset({
            resultado: null,
            metodoVictoria: null,
            otroMetodoVictoria: '',
            tiempo: '',
            jueces: '',
            observaciones: '',
          });

          /*
           * Mensaje solicitado.
           */
          this.successMessage.set(
            'Combate registrado correctamente.',
          );

          /*
           * Recargamos los combates
           * pero NO eliminamos
           * dojoFiltro.
           *
           * Por eso permanece
           * seleccionado el dojo.
           */
          this.load();
        },

        error: (err) => {
          this.saving.set(
            false,
          );

          this.formError.set(
            extractErrorMessage(
              err,
              'No se pudo guardar el resultado.',
            ),
          );
        },
      });
  }

  // =========================
  // CANCELAR COMBATE
  // =========================

  cancelarCombate(): void {
    const combate =
      this.selectedCombate();

    if (!combate) {
      return;
    }

    this.combateService
      .cancelar(
        combate._id,
      )
      .subscribe({
        next: (
          actualizado,
        ) => {
          this.replaceCombate(
            actualizado,
          );

          this.selectedCombateId.set(
            '',
          );

          this.activeTab.set(
            'Pendiente',
          );
        },

        error: (err) => {
          this.formError.set(
            extractErrorMessage(
              err,
              'No se pudo cancelar el combate.',
            ),
          );
        },
      });
  }

  // =========================
  // ACTUALIZAR COMBATE LOCAL
  // =========================

  private replaceCombate(
    actualizado: Combate,
  ): void {
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

  // =========================
  // TIEMPO
  // =========================

  private parseTiempo(
    value: string,
  ): number | null {
    const match =
      value
        ?.trim()
        .match(
          /^(\d+):([0-5]?\d)$/,
        );

    if (!match) {
      return null;
    }

    return (
      parseInt(
        match[1],
        10,
      ) *
        60 +
      parseInt(
        match[2],
        10,
      )
    );
  }

  formatSegundos(
    segundos:
      | number
      | null,
  ): string {
    if (
      segundos === null ||
      segundos === undefined
    ) {
      return '';
    }

    const min =
      Math.floor(
        segundos / 60,
      );

    const sec =
      segundos % 60;

    return `${min}:${sec
      .toString()
      .padStart(
        2,
        '0',
      )}`;
  }

  // =========================
  // EQUIPO
  // =========================

  equipoNombre(
    robot: Combate['robot1'],
  ): string {
    const equipo =
      robot?.equipo;

    if (!equipo) {
      return '';
    }

    return typeof equipo ===
      'string'
      ? equipo
      : equipo.nombre;
  }

  // =========================
  // BADGES
  // =========================

  estadoBadgeClass(
    estado: EstadoCombate,
  ): string {
    switch (estado) {
      case EstadoCombate.PENDIENTE:
        return 'badge--neutral';

      case EstadoCombate.EN_CURSO:
        return 'badge--warning';

      default:
        return 'badge--success';
    }
  }

  // =========================
  // HORA
  // =========================

  formatHora(
    fecha: string,
  ): string {
    if (!fecha) {
      return '';
    }

    return new Date(
      fecha,
    ).toLocaleTimeString(
      'es-MX',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  }
}