import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';

import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { CombateService } from '../../core/services/combate.service';
import { RankingService } from '../../core/services/ranking.service';
import { AuthService } from '../../core/services/auth.service';

import { Torneo } from '../../core/models/torneo.model';
import { FilaRanking } from '../../core/models/ranking.model';
import {
  Combate,
  EstadoCombate,
  FaseCombate,
} from '../../core/models/combate.model';
import { extractErrorMessage } from '../../core/utils/error-message.util';

interface PosicionBloque extends FilaRanking {
  bloqueId: string;
  bloqueNombre: string;
}

interface TablaBloque {
  bloqueId: string;
  bloqueNombre: string;
  posiciones: PosicionBloque[];
}

interface CruceEditable {
  robot1Id: string;
  robot2Id: string;
}

@Component({
  selector: 'app-torneo-clasificados',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl: './torneo-clasificados.component.html',
  styleUrl: './torneo-clasificados.component.scss',
})
export class TorneoClasificadosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly torneoService = inject(TorneoService);
  private readonly bloqueService = inject(BloqueService);
  private readonly combateService = inject(CombateService);
  private readonly rankingService = inject(RankingService);
  private readonly auth = inject(AuthService);

  readonly torneoId =
    this.route.snapshot.paramMap.get('id') ?? '';

  readonly torneo = signal<Torneo | null>(null);
  readonly tablas = signal<TablaBloque[]>([]);
  readonly cruces = signal<CruceEditable[]>([]);

  readonly sidebarOpen = signal(false);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly faseGenerada = signal(false);
  readonly gruposTerminados = signal(false);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly isAdmin = this.auth.isAdmin;

  readonly fasesIniciales = [
    { fase: FaseCombate.SEMIFINAL, robots: 4, combates: 2 },
    { fase: FaseCombate.CUARTOS, robots: 8, combates: 4 },
    { fase: FaseCombate.OCTAVOS, robots: 16, combates: 8 },
    { fase: FaseCombate.DIECISEISAVOS, robots: 32, combates: 16 },
  ];

  readonly faseInicial = signal<FaseCombate>(
    FaseCombate.CUARTOS,
  );

  readonly candidatos = computed(() =>
    this.tablas().flatMap((tabla) => tabla.posiciones),
  );

  readonly cantidadNecesaria = computed(() =>
    this.fasesIniciales.find(
      (opcion) => opcion.fase === this.faseInicial(),
    )?.robots ?? 0,
  );

  readonly validacion = computed<string | null>(() => {
    if (!this.gruposTerminados()) {
      return 'Primero deben terminar los combates de la fase de grupos.';
    }

    if (this.candidatos().length < this.cantidadNecesaria()) {
      return `Esta fase necesita ${this.cantidadNecesaria()} robots.`;
    }

    const ids = this.cruces().flatMap(
      (cruce) => [cruce.robot1Id, cruce.robot2Id],
    );

    if (
      ids.length !== this.cantidadNecesaria() ||
      ids.some((id) => !id)
    ) {
      return 'Selecciona los dos robots de cada combate.';
    }

    if (new Set(ids).size !== ids.length) {
      return 'Hay robots repetidos en los cruces.';
    }

    const permitidos = new Set(
      this.candidatos().map((robot) => robot.robotId),
    );

    if (ids.some((id) => !permitidos.has(id))) {
      return 'Hay un robot que no pertenece a estas posiciones.';
    }

    return null;
  });

  ngOnInit(): void {
    this.prepararCruces();

    this.torneoService.findOne(this.torneoId).subscribe({
      next: (torneo) => this.torneo.set(torneo),
    });

    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      bloques: this.bloqueService.findByTorneo(this.torneoId),
      combates: this.combateService.findByTorneo(this.torneoId),
    })
      .pipe(
        switchMap(({ bloques, combates }) => {
          const ordenados = [...bloques].sort(
            (a, b) =>
              a.nombre.length - b.nombre.length ||
              a.nombre.localeCompare(b.nombre),
          );

          const consultas = ordenados.map((bloque) =>
            this.rankingService.calcular(this.torneoId, {
              bloque: bloque._id,
            }),
          );

          return forkJoin({
            rankings: consultas.length
              ? forkJoin(consultas)
              : of([] as FilaRanking[][]),
            bloques: of(ordenados),
            combates: of(combates),
          });
        }),
      )
      .subscribe({
        next: ({ bloques, rankings, combates }) => {
          this.tablas.set(
            bloques.map((bloque, indice) => ({
              bloqueId: bloque._id,
              bloqueNombre: bloque.nombre,
              posiciones: (rankings[indice] ?? []).map(
                (fila) => ({
                  ...fila,
                  bloqueId: bloque._id,
                  bloqueNombre: bloque.nombre,
                }),
              ),
            })),
          );

          const grupos = combates.filter(
            (combate) =>
              combate.fase === FaseCombate.FASE_GRUPOS,
          );

          this.gruposTerminados.set(
            grupos.length > 0 &&
            grupos.every(
              (combate) =>
                combate.estado === EstadoCombate.FINALIZADO &&
                combate.resultado !== null,
            ),
          );

          const eliminatorios = combates.filter(
            (combate) =>
              combate.fase !== FaseCombate.FASE_GRUPOS,
          );

          this.faseGenerada.set(eliminatorios.length > 0);

          if (eliminatorios.length > 0) {
            this.mostrarCuadroExistente(eliminatorios);
          } else {
            const disponibles = this.candidatos().length;

            const opcion = [...this.fasesIniciales]
              .reverse()
              .find((item) => item.robots <= disponibles);

            this.faseInicial.set(
              opcion?.fase ?? FaseCombate.SEMIFINAL,
            );

            this.prepararCruces();
          }

          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudieron cargar las posiciones.',
            ),
          );
        },
      });
  }

  private mostrarCuadroExistente(combates: Combate[]): void {
    const orden = [
      FaseCombate.PRELIMINAR,
      FaseCombate.DIECISEISAVOS,
      FaseCombate.OCTAVOS,
      FaseCombate.CUARTOS,
      FaseCombate.SEMIFINAL,
      FaseCombate.FINAL,
    ];

    const fase = orden.find((item) =>
      combates.some((combate) => combate.fase === item),
    );

    if (!fase) return;

    this.faseInicial.set(fase);

    this.cruces.set(
      combates
        .filter((combate) => combate.fase === fase)
        .sort((a, b) => a.numero - b.numero)
        .map((combate) => ({
          robot1Id: combate.robot1._id,
          robot2Id: combate.robot2._id,
        })),
    );
  }

  cambiarFase(valor: string): void {
    if (this.faseGenerada() || this.generating()) return;

    const opcion = this.fasesIniciales.find(
      (item) => item.fase === valor,
    );

    if (!opcion) return;

    this.faseInicial.set(opcion.fase);
    this.prepararCruces();
    this.errorMessage.set(null);
  }

  private prepararCruces(): void {
    const cantidad = this.fasesIniciales.find(
      (item) => item.fase === this.faseInicial(),
    )?.combates ?? 0;

    this.cruces.set(
      Array.from({ length: cantidad }, () => ({
        robot1Id: '',
        robot2Id: '',
      })),
    );
  }

  seleccionar(
    indice: number,
    lado: 'robot1Id' | 'robot2Id',
    robotId: string,
  ): void {
    if (
      !this.isAdmin() ||
      this.faseGenerada() ||
      this.generating()
    ) {
      return;
    }

    this.cruces.update((actuales) =>
      actuales.map((cruce, posicion) =>
        posicion === indice
          ? { ...cruce, [lado]: robotId }
          : cruce,
      ),
    );
  }

  ocupado(robotId: string, seleccionActual: string): boolean {
    if (robotId === seleccionActual) return false;

    return this.cruces().some(
      (cruce) =>
        cruce.robot1Id === robotId ||
        cruce.robot2Id === robotId,
    );
  }

  etiqueta(robot: PosicionBloque): string {
    return `${robot.posicion}.º de ${robot.bloqueNombre} — ${robot.robotNombre}`;
  }

  puedeGenerar(): boolean {
    return (
      this.isAdmin() &&
      !this.loading() &&
      !this.generating() &&
      !this.faseGenerada() &&
      this.validacion() === null
    );
  }

  generarFaseEliminatoria(): void {
    if (!this.puedeGenerar()) return;

    const confirmado = window.confirm(
      `Se confirmarán ${this.cruces().length} combates de ${this.faseInicial()}. Revisa el orden: los ganadores de los combates 1 y 2 se cruzarán en la siguiente fase, después los de 3 y 4, y así sucesivamente. ¿Continuar?`,
    );

    if (!confirmado) return;

    this.generating.set(true);
    this.errorMessage.set(null);

    this.rankingService
      .generarCuadroManual(this.torneoId, {
        faseInicial: this.faseInicial(),
        cruces: this.cruces().map((cruce) => ({ ...cruce })),
      })
      .subscribe({
        next: (respuesta) => {
          this.generating.set(false);
          this.faseGenerada.set(true);
          this.successMessage.set(respuesta.mensaje);
        },
        error: (err) => {
          this.generating.set(false);
          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo confirmar el cuadro.',
            ),
          );
        },
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((valor) => !valor);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}