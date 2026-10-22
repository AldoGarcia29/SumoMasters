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

import { catchError, forkJoin, of } from 'rxjs';

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

readonly combatesPorHorario = signal(4);

cambiarCombatesPorHorario(valor: string): void {
  const cantidad = Number(valor);

  if (
    !Number.isInteger(cantidad) ||
    cantidad < 1 ||
    Object.values(this.guardandoRondas()).some(Boolean)
  ) {
    return;
  }

  this.combatesPorHorario.set(cantidad);
}

tandasDeRonda(
  numero: number,
  combates: Combate[],
): {
  clave: string;
  titulo: string;
  desde: number;
  hasta: number;
  combates: Combate[];
}[] {
  const cantidad = this.combatesPorHorario();
  const tandas = [];

  for (let inicio = 0; inicio < combates.length; inicio += cantidad) {
    const seleccionados = combates.slice(inicio, inicio + cantidad);

    tandas.push({
      clave: `${numero}:tanda:${inicio / cantidad + 1}`,
      titulo: `Horario ${inicio / cantidad + 1}`,
      desde: inicio + 1,
      hasta: inicio + seleccionados.length,
      combates: seleccionados,
    });
  }

  return tandas;
}


readonly horariosRonda = signal<Record<string, string>>({});
readonly guardandoRondas = signal<Record<string, boolean>>({});

private claveRonda(numero: number | string): string {
  return `${this.activeFase()}:${numero}`;
}

valorHorario(combate: Combate): string {
  if (!combate.horarioProgramado) return '';

  const fecha = new Date(combate.horarioProgramado);

  if (!Number.isFinite(fecha.getTime())) return '';

  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);

  const parte = (tipo: string): string =>
    partes.find((item) => item.type === tipo)?.value ?? '';

  return `${parte('year')}-${parte('month')}-${parte('day')}T${parte('hour')}:${parte('minute')}`;
}

valorHorarioRonda(
  numero: number | string,
  combates: Combate[],
): string {
  const clave = this.claveRonda(numero);
  const editados = this.horariosRonda();

  if (Object.prototype.hasOwnProperty.call(editados, clave)) {
    return editados[clave];
  }

  const valores = combates.map(
    (combate) => this.valorHorario(combate),
  );

  // No muestra como uniforme un horario que aún
  // solo está guardado en algunos combates.
  return valores.length > 0 &&
    valores.every((valor) => valor === valores[0])
      ? valores[0]
      : '';
}

horariosDistintos(combates: Combate[]): boolean {
  return new Set(
    combates.map((combate) => this.valorHorario(combate)),
  ).size > 1;
}

editarHorarioRonda(numero: number | string, valor: string): void {
  const clave = this.claveRonda(numero);

  this.horariosRonda.update((actuales) => ({
    ...actuales,
    [clave]: valor,
  }));
}

guardandoRonda(numero: number | string): boolean {
  return this.guardandoRondas()[this.claveRonda(numero)] ?? false;
}

rondaModificada(numero: number | string): boolean {
  return Object.prototype.hasOwnProperty.call(
    this.horariosRonda(),
    this.claveRonda(numero),
  );
}

guardarHorarioRonda(
  numero: number | string,
  combates: Combate[],
): void {
  if (
    this.guardandoRonda(numero) ||
    !this.rondaModificada(numero) ||
    combates.length === 0
  ) {
    return;
  }

  const clave = this.claveRonda(numero);
  const fase = this.activeFase();
  const valor = this.valorHorarioRonda(numero, combates);
  const horario = valor ? `${valor}:00-06:00` : null;

  if (
    horario !== null &&
    !Number.isFinite(Date.parse(horario))
  ) {
    this.errorMessage.set('Selecciona una fecha y hora válidas.');
    return;
  }

  this.guardandoRondas.update((actuales) => ({
    ...actuales,
    [clave]: true,
  }));

  this.errorMessage.set(null);
  this.successMessage.set(null);

  forkJoin(
    combates.map((combate) =>
      this.combateService
        .actualizarHorario(
          this.torneoId,
          combate._id,
          horario,
        )
        .pipe(
          catchError(() => of(null)),
        ),
    ),
  ).subscribe((respuestas) => {
    const actualizados = respuestas.filter(
      (item): item is Combate => item !== null,
    );

    const porId = new Map(
      actualizados.map((item) => [item._id, item]),
    );

    this.combates.update((actuales) =>
      actuales.map((item) => porId.get(item._id) ?? item),
    );

    const cacheados =
      this.flowCache.getCombates(this.torneoId) ?? [];

    this.flowCache.setCombates(
      this.torneoId,
      cacheados.map((item) => porId.get(item._id) ?? item),
    );

    this.guardandoRondas.update((actuales) => ({
      ...actuales,
      [clave]: false,
    }));

    if (actualizados.length !== combates.length) {
      if (this.activeFase() === fase) {
        this.errorMessage.set(
          `Se guardaron ${actualizados.length} de ${combates.length} horarios. Pulsa Guardar ronda para reintentar los restantes.`,
        );
      }

      return;
    }

    this.horariosRonda.update((actuales) => {
      const copia = { ...actuales };
      delete copia[clave];
      return copia;
    });

    if (this.activeFase() === fase) {
      this.successMessage.set(
        horario
          ? 'Hora de inicio de la ronda guardada.'
          : 'Horario de la ronda eliminado.',
      );
    }
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
  const bloqueId = this.obtenerBloqueId(combate);

  const bloque = this.bloques().find(
    (item) => item._id === bloqueId,
  );

  if (bloque) return bloque.nombre;

  // Si la referencia del combate está incompleta,
  // identifica el bloque por sus participantes.
  const porRobots = this.bloques().find((item) => {
    const ids = new Set(
      item.robots.map((robot) => String(robot._id)),
    );

    return (
      !!combate.robot1 &&
      !!combate.robot2 &&
      ids.has(String(combate.robot1._id)) &&
      ids.has(String(combate.robot2._id))
    );
  });

  return (
    porRobots?.nombre ??
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

    identificarTanda(
    _index: number,
    tanda: { clave: string },
  ): string {
    return tanda.clave;
  }

  abrirCalendario(input: HTMLInputElement): void {
    if (input.disabled) return;

    input.focus();

    try {
      input.showPicker?.();
    } catch {
      // El campo permite escribir la fecha manualmente.
    }
  }
}