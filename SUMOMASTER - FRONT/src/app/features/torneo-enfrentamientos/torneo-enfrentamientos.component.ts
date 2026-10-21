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
  Router,
  RouterLink,
} from '@angular/router';

import { extractErrorMessage } from '../../core/utils/error-message.util';

import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';

import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { CombateService } from '../../core/services/combate.service';
import { TorneoFlowCacheService } from '../../core/services/torneo-flow-cache.service';

import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';
import {
  Combate,
  FaseCombate,
} from '../../core/models/combate.model';

@Component({
  selector: 'app-torneo-enfrentamientos',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
    RobotChipComponent,
  ],
  templateUrl:
    './torneo-enfrentamientos.component.html',
  styleUrl:
    './torneo-enfrentamientos.component.scss',
})
export class TorneoEnfrentamientosComponent
  implements OnInit
{


  readonly horariosEditados = signal<Record<string, string>>({});
readonly guardandoHorarios = signal<Record<string, boolean>>({});

valorHorario(combate: Combate): string {
  const editados = this.horariosEditados();

  if (
    Object.prototype.hasOwnProperty.call(
      editados,
      combate._id,
    )
  ) {
    return editados[combate._id];
  }

  if (!combate.horarioProgramado) return '';

  const fecha = new Date(combate.horarioProgramado);

  if (!Number.isFinite(fecha.getTime())) return '';

  // Muestra el horario del evento en Querétaro.
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);

  const valor = (tipo: string): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${valor('year')}-${valor('month')}-${valor('day')}T${valor('hour')}:${valor('minute')}`;
}

editarHorario(combateId: string, valor: string): void {
  this.horariosEditados.update((actuales) => ({
    ...actuales,
    [combateId]: valor,
  }));
}

horarioModificado(combateId: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    this.horariosEditados(),
    combateId,
  );
}

guardarHorario(combate: Combate): void {
  if (
    this.guardandoHorarios()[combate._id] ||
    !this.horarioModificado(combate._id)
  ) {
    return;
  }

  const valor = this.valorHorario(combate);

  // Para el evento en Querétaro, el horario se envía
  // con desplazamiento UTC-06:00.
  const horario = valor
    ? `${valor}:00-06:00`
    : null;

  if (
    horario !== null &&
    !Number.isFinite(Date.parse(horario))
  ) {
    this.errorMessage.set(
      'Selecciona una fecha y hora válidas.',
    );
    return;
  }

  this.guardandoHorarios.update((actuales) => ({
    ...actuales,
    [combate._id]: true,
  }));

  this.errorMessage.set(null);
  this.successMessage.set(null);

  this.combateService
    .actualizarHorario(
      this.torneoId,
      combate._id,
      horario,
    )
    .subscribe({
      next: (actualizado) => {
        this.combates.update((actuales) =>
          actuales.map((item) =>
            item._id === actualizado._id
              ? actualizado
              : item,
          ),
        );

        const cacheados =
          this.flowCache.getCombates(this.torneoId) ?? [];

        this.flowCache.setCombates(
          this.torneoId,
          cacheados.map((item) =>
            item._id === actualizado._id
              ? actualizado
              : item,
          ),
        );

        this.horariosEditados.update((actuales) => {
          const copia = { ...actuales };
          delete copia[combate._id];
          return copia;
        });

        this.guardandoHorarios.update((actuales) => ({
          ...actuales,
          [combate._id]: false,
        }));

        this.successMessage.set(
          horario
            ? 'Horario guardado correctamente.'
            : 'Horario eliminado correctamente.',
        );
      },
      error: (err) => {
        this.guardandoHorarios.update((actuales) => ({
          ...actuales,
          [combate._id]: false,
        }));

        this.errorMessage.set(
          extractErrorMessage(
            err,
            'No se pudo guardar el horario.',
          ),
        );
      },
    });
}


  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly torneoService =
    inject(TorneoService);

  private readonly bloqueService =
    inject(BloqueService);

  private readonly combateService =
    inject(CombateService);

  private readonly flowCache =
    inject(TorneoFlowCacheService);

  readonly torneoId =
    this.route.snapshot.paramMap.get('id') ?? '';

  readonly torneo =
    signal<Torneo | null>(null);

  readonly bloques =
    signal<Bloque[]>([]);

  readonly selectedBloqueId =
    signal<string>('');

  readonly combates =
    signal<Combate[]>([]);

  readonly FaseCombate = FaseCombate;
  readonly fases = Object.values(FaseCombate);

  readonly activeFase =
    signal<FaseCombate>(
      FaseCombate.FASE_GRUPOS,
    );
  
  readonly rondas = computed(() => {
  const grupos = new Map<number, Combate[]>();
  const esGrupos =
    this.activeFase() === FaseCombate.FASE_GRUPOS;

  for (const combate of this.combates()) {
    const numero = esGrupos ? (combate.ronda ?? 0) : 0;
    const lista = grupos.get(numero) ?? [];

    lista.push(combate);
    grupos.set(numero, lista);
  }

  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([numero, combates]) => ({
      numero,
      titulo: esGrupos
        ? numero > 0
          ? `Ronda ${numero}`
          : 'Combates sin ronda registrada'
        : this.activeFase(),
      combates: [...combates].sort((a, b) => {
        const nombreA = this.nombreBloqueCombate(a);
        const nombreB = this.nombreBloqueCombate(b);

        return (
          nombreA.length - nombreB.length ||
          nombreA.localeCompare(nombreB, 'es', {
            numeric: true,
          }) ||
          a.numero - b.numero
        );
      }),
    }));
});

nombreBloqueCombate(combate: Combate): string {
  const id = this.obtenerBloqueId(combate);

  return (
    this.bloques().find((bloque) => bloque._id === id)?.nombre ??
    combate.bloque?.nombre ??
    'Sin bloque'
  );
}

  readonly sidebarOpen = signal(false);
  readonly loading = signal(false);
  readonly loadingBloques = signal(false);
  readonly generating = signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

  ngOnInit(): void {
    this.leerFaseDesdeUrl();

    this.torneoService
      .findOne(this.torneoId)
      .subscribe({
        next: (torneo) => {
          this.torneo.set(torneo);
        },

        error: (err) => {
          console.error(
            '[Torneo] No se pudo cargar:',
            err,
          );
        },
      });

    const bloquesDesdeNavegacion = (
      history.state as {
        bloques?: Bloque[];
      } | null
    )?.bloques;

    const bloquesDesdeCache =
      this.flowCache.getBloques(
        this.torneoId,
      );

    const bloquesIniciales =
      bloquesDesdeNavegacion &&
      bloquesDesdeNavegacion.length > 0
        ? bloquesDesdeNavegacion
        : bloquesDesdeCache;

    if (
      bloquesIniciales &&
      bloquesIniciales.length > 0
    ) {
      this.bloques.set(
        bloquesIniciales,
      );

      this.flowCache.setBloques(
        this.torneoId,
        bloquesIniciales,
      );

      this.selectedBloqueId.set(
        bloquesIniciales[0]._id,
      );

      this.loadCombates();
      return;
    }

    this.loadBloques();
  }

  private leerFaseDesdeUrl(): void {
    const faseUrl =
      this.route.snapshot.queryParamMap.get(
        'fase',
      );

    if (!faseUrl) return;

    const esFaseValida =
      Object.values(FaseCombate).includes(
        faseUrl as FaseCombate,
      );

    if (esFaseValida) {
      this.activeFase.set(
        faseUrl as FaseCombate,
      );
    }
  }

  loadBloques(
    reintentoSilencioso = false,
  ): void {
    this.loadingBloques.set(true);

    this.bloqueService
      .findByTorneo(this.torneoId)
      .subscribe({
        next: (bloques) => {
          this.loadingBloques.set(false);

          if (bloques.length > 0) {
            this.bloques.set(bloques);

            this.flowCache.setBloques(
              this.torneoId,
              bloques,
            );

            if (
              !this.selectedBloqueId()
            ) {
              this.selectedBloqueId.set(
                bloques[0]._id,
              );
            }

            this.loadCombates();
            return;
          }

          if (!reintentoSilencioso) {
            setTimeout(
              () =>
                this.loadBloques(true),
              900,
            );
          }
        },

        error: (err) => {
          this.loadingBloques.set(false);

          console.error(
            '[Bloques] Error al cargar los bloques:',
            err,
          );

          if (
            this.bloques().length === 0
          ) {
            this.errorMessage.set(
              extractErrorMessage(
                err,
                'No se pudieron cargar los bloques de este torneo.',
              ),
            );
          }
        },
      });
  }

  setFase(fase: FaseCombate): void {
    this.activeFase.set(fase);
    this.combates.set([]);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        fase,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.loadCombates();
  }

  onBloqueChange(
    bloqueId: string,
  ): void {
    this.selectedBloqueId.set(
      bloqueId,
    );

    this.combates.set([]);
    this.loadCombates();
  }

  loadCombates(): void {
  const fase = this.activeFase();

  // Carga todos los bloques de la fase.
  this.cargarDesdeCache(fase);
  this.loading.set(true);
  this.errorMessage.set(null);

  this.combateService
    .findByTorneo(this.torneoId, { fase })
    .subscribe({
      next: (data) => {
        // Ignora respuestas de una pestaña anterior.
        if (this.activeFase() !== fase) return;

        this.combates.set(data);

        // Sustituye la fase consultada para no conservar
        // documentos antiguos después de regenerar.
        const otrasFases = (
          this.flowCache.getCombates(this.torneoId) ?? []
        ).filter((combate) => combate.fase !== fase);

        this.flowCache.setCombates(this.torneoId, [
          ...otrasFases,
          ...data,
        ]);

        this.loading.set(false);
      },
      error: (err) => {
        if (this.activeFase() !== fase) return;

        this.loading.set(false);
        this.errorMessage.set(
          extractErrorMessage(
            err,
            'No se pudieron cargar los enfrentamientos.',
          ),
        );
      },
    });
}

  private cargarDesdeCache(
    fase: FaseCombate,
    bloqueId?: string,
  ): void {
    const cacheados =
      this.flowCache.getCombates(
        this.torneoId,
      );

    if (
      !cacheados ||
      cacheados.length === 0
    ) {
      return;
    }

    const filtrados =
      cacheados.filter((combate) => {
        if (
          combate.fase !== fase
        ) {
          return false;
        }

        if (!bloqueId) {
          return true;
        }

        return (
          this.obtenerBloqueId(
            combate,
          ) === bloqueId
        );
      });

    if (filtrados.length > 0) {
      this.combates.set(filtrados);
    }
  }

  private guardarEnCache(
    nuevos: Combate[],
  ): void {
    const anteriores =
      this.flowCache.getCombates(
        this.torneoId,
      ) ?? [];

    const porId = new Map<
      string,
      Combate
    >();

    for (const combate of anteriores) {
      porId.set(
        combate._id,
        combate,
      );
    }

    for (const combate of nuevos) {
      porId.set(
        combate._id,
        combate,
      );
    }

    this.flowCache.setCombates(
      this.torneoId,
      Array.from(porId.values()),
    );
  }

  private obtenerBloqueId(
    combate: Combate,
  ): string {
    const bloque = combate.bloque;

    if (!bloque) {
      return '';
    }

    if (typeof bloque === 'string') {
      return bloque;
    }

    return bloque._id;
  }

  generar(): void {
    /*
     * La generación normal de enfrentamientos
     * corresponde a la fase de grupos.
     * Las fases eliminatorias se generan desde
     * sus endpoints específicos.
     */
    if (
      this.activeFase() !==
      FaseCombate.FASE_GRUPOS
    ) {
      this.errorMessage.set(
        'Los enfrentamientos eliminatorios deben generarse desde la vista de clasificados.',
      );

      return;
    }

    const bloqueIds =
      this.bloques().map(
        (bloque) => bloque._id,
      );

    if (bloqueIds.length === 0) {
      this.errorMessage.set(
        'No hay bloques disponibles para generar enfrentamientos.',
      );

      return;
    }

    this.generating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService
      .generar(this.torneoId, {
        bloqueIds,
        fase:
          FaseCombate.FASE_GRUPOS,
      })
      .subscribe({
        next: (
          combatesGenerados,
        ) => {
          this.generating.set(false);

          this.successMessage.set(
            'Enfrentamientos generados correctamente.',
          );

          const otrasFases = (
  this.flowCache.getCombates(this.torneoId) ?? []
).filter(
  (combate) =>
    combate.fase !== FaseCombate.FASE_GRUPOS,
);

this.flowCache.setCombates(this.torneoId, [
  ...otrasFases,
  ...combatesGenerados,
]);

          if (this.activeFase() === FaseCombate.FASE_GRUPOS) {
  this.combates.set(combatesGenerados);
}
        },

        error: (err) => {
          this.generating.set(false);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudieron generar los enfrentamientos.',
            ),
          );
        },
      });
  }

  bloqueNombre(id: string): string {
    return (
      this.bloques().find(
        (bloque) =>
          bloque._id === id,
      )?.nombre ?? ''
    );
  }

  continuar(): void {
    this.router.navigate(
      [
        '/torneos',
        this.torneoId,
        'dojos',
      ],
      {
        queryParams: {
          fase: this.activeFase(),
        },
      },
    );
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(
      (value) => !value,
    );
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}