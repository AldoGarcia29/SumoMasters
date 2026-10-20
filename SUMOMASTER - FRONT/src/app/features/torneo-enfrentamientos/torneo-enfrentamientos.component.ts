import { CommonModule } from '@angular/common';
import {
  Component,
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

    const esFaseDeGrupos =
      fase ===
      FaseCombate.FASE_GRUPOS;

    /*
     * En fase de grupos sí filtramos por bloque.
     * En eliminatorias cargamos toda la ronda,
     * porque los combates preliminares pueden
     * involucrar robots de diferentes bloques.
     */
    const bloqueId = esFaseDeGrupos
      ? this.selectedBloqueId()
      : undefined;

    if (
      esFaseDeGrupos &&
      !bloqueId
    ) {
      return;
    }

    this.cargarDesdeCache(
      fase,
      bloqueId,
    );

    this.loading.set(true);
    this.errorMessage.set(null);

    this.combateService
      .findByTorneo(this.torneoId, {
        fase,
        bloque: bloqueId,
      })
      .subscribe({
        next: (data) => {
          this.loading.set(false);
          this.combates.set(data);

          this.guardarEnCache(data);
        },

        error: (err) => {
          this.loading.set(false);

          console.error(
            '[Combates] Error al cargar:',
            err,
          );

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

          this.guardarEnCache(
            combatesGenerados,
          );

          const bloqueActual =
            this.selectedBloqueId();

          this.combates.set(
            combatesGenerados.filter(
              (combate) =>
                this.obtenerBloqueId(
                  combate,
                ) === bloqueActual,
            ),
          );
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