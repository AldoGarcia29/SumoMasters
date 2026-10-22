import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  EMPTY,
  Subscription,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  map,
  switchMap,
  timer,
} from 'rxjs';

import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import {
  CombateLive,
  LiveData,
  TorneoResumen,
} from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';
import { FaseCombate } from '../../core/models/combate.model';

const POLL_MS = 10_000;
const ROTACION_MS = 15_000;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Component({
  selector: 'app-live-combates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LiveUserMenuComponent,
  ],
  templateUrl: './live-combates.component.html',
  styleUrls: ['./live-combates.component.css'],
})
export class LiveCombatesComponent implements OnInit, OnDestroy {
  id = '';
  data: LiveData | null = null;
  torneos: TorneoResumen[] = [];

  error: string | null = null;
  aviso: string | null = null;
  cargando = true;

  faseSeleccionada = '';
  rondaSeleccionada = '';

  busca = '';
  soloPendientes = false;

  modoProyeccion = false;
  rotacionAutomatica = false;

  pagina = 0;
  readonly porPagina = 6;

  private readonly subs = new Subscription();
  private readonly fotosFallidas = new Set<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: PublicApiService,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.api.getTorneos().subscribe({
        next: (torneos) => {
          this.torneos = torneos;
        },
        error: () => {
          this.aviso =
            'No se pudo cargar el selector de torneos. Recarga para reintentar.';
        },
      }),
    );

    this.subs.add(
      this.route.paramMap
        .pipe(
          map((params) => params.get('id') ?? ''),
          distinctUntilChanged(),
          switchMap((id) => {
            this.id = id;
            this.data = null;
            this.error = null;
            this.cargando = true;

            this.faseSeleccionada = '';
            this.rondaSeleccionada = '';
            this.busca = '';
            this.soloPendientes = false;
            this.pagina = 0;
            this.fotosFallidas.clear();

            if (!id) {
              this.cargando = false;
              this.error = 'Torneo no disponible.';
              return EMPTY;
            }

            return timer(0, POLL_MS).pipe(
              exhaustMap(() =>
                this.api.getLive(id).pipe(
                  catchError((err) => {
                    this.cargando = false;

                    if (err?.status === 404) {
                      this.data = null;
                      this.error =
                        'El torneo no existe o no está disponible al público.';
                    } else {
                      this.error =
                        'Sin conexión. Los datos pueden estar desactualizados; reintentando…';
                    }

                    return EMPTY;
                  }),
                ),
              ),
            );
          }),
        )
        .subscribe((data) => {
          this.data = data;
          this.error = null;
          this.cargando = false;

          this.validarSeleccion();
          this.ajustarPagina();
        }),
    );

    this.subs.add(
      timer(ROTACION_MS, ROTACION_MS).subscribe(() => {
        if (
          this.rotacionAutomatica &&
          this.totalPaginas > 1
        ) {
          this.pagina =
            (this.pagina + 1) % this.totalPaginas;
        }
      }),
    );
  }

  get esGrupos(): boolean {
    return this.faseSeleccionada === FaseCombate.FASE_GRUPOS;
  }

  get fases(): string[] {
    const disponibles = new Set(
      (this.data?.combates ?? []).map(
        (combate) => combate.fase || 'Sin fase',
      ),
    );

    const conocidas: string[] = Object.values(FaseCombate);

    return [
      ...conocidas.filter((fase) => disponibles.has(fase)),
      ...[...disponibles].filter(
        (fase) => !conocidas.includes(fase),
      ),
    ];
  }

  get rondas(): number[] {
    return [
      ...new Set(
        (this.data?.combates ?? [])
          .filter(
            (combate) =>
              combate.fase === FaseCombate.FASE_GRUPOS,
          )
          .map((combate) => combate.ronda ?? 0),
      ),
    ].sort((a, b) => a - b);
  }

  get filtrados(): CombateLive[] {
    const consulta = normalizar(this.busca.trim());

    return (this.data?.combates ?? [])
      .filter((combate) => {
        if (
          (combate.fase || 'Sin fase') !==
          this.faseSeleccionada
        ) {
          return false;
        }

        if (
          this.esGrupos &&
          this.rondaSeleccionada !== '' &&
          String(combate.ronda ?? 0) !==
            this.rondaSeleccionada
        ) {
          return false;
        }

        if (
          this.soloPendientes &&
          this.terminado(combate)
        ) {
          return false;
        }

        if (consulta) {
          const nombres = [
            this.nombreRobot(combate, 1),
            this.nombreRobot(combate, 2),
          ];

          if (
            !nombres.some((nombre) =>
              normalizar(nombre).includes(consulta),
            )
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const porRonda = this.esGrupos
          ? (a.ronda ?? 0) - (b.ronda ?? 0)
          : 0;

        if (porRonda !== 0) return porRonda;

        if (this.esGrupos) {
          const grupoA = a.bloque ?? '';
          const grupoB = b.bloque ?? '';

          const porGrupo =
            grupoA.length - grupoB.length ||
            grupoA.localeCompare(grupoB, 'es', {
              numeric: true,
            });

          if (porGrupo !== 0) return porGrupo;
        }

        return a.numero - b.numero;
      });
  }

  get visibles(): CombateLive[] {
    const inicio = this.pagina * this.porPagina;

    return this.filtrados.slice(
      inicio,
      inicio + this.porPagina,
    );
  }

  get totalPaginas(): number {
    return Math.max(
      1,
      Math.ceil(this.filtrados.length / this.porPagina),
    );
  }

  get tituloRonda(): string {
    if (!this.esGrupos) return '';

    if (this.rondaSeleccionada === '') {
      return 'Todas las rondas';
    }

    return this.rondaSeleccionada === '0'
      ? 'Sin ronda registrada'
      : `Ronda ${this.rondaSeleccionada}`;
  }

  cambiarTorneo(id: string): void {
    if (!id || id === this.id) return;

    void this.router.navigate(['/live', id, 'combates']);
  }

  cambiarFase(fase: string): void {
    this.faseSeleccionada = fase;

    this.rondaSeleccionada =
      this.esGrupos && this.rondas.length > 0
        ? String(this.rondas[0])
        : '';

    this.pagina = 0;
  }

  reiniciarPagina(): void {
    this.pagina = 0;
  }

  anterior(): void {
    this.pagina = Math.max(0, this.pagina - 1);
  }

  siguiente(): void {
    this.pagina = Math.min(
      this.totalPaginas - 1,
      this.pagina + 1,
    );
  }

  terminado(combate: CombateLive): boolean {
    return combate.estado === 'Finalizado';
  }

  nombreRobot(
    combate: CombateLive,
    lado: 1 | 2,
  ): string {
    const robot =
      lado === 1 ? combate.robot1 : combate.robot2;

    return (
      robot?.nombre ||
      combate.robots[lado - 1] ||
      'Por definir'
    );
  }

  fotoRobot(
    combate: CombateLive,
    lado: 1 | 2,
  ): string | null {
    const robot =
      lado === 1 ? combate.robot1 : combate.robot2;

    const imagen = robot?.imagenUrl;

    return imagen && !this.fotosFallidas.has(imagen)
      ? imagen
      : null;
  }

  marcarFotoFallida(url: string): void {
    this.fotosFallidas.add(url);
  }

  ganador(
    combate: CombateLive,
    lado: 1 | 2,
  ): boolean {
    return (
      this.terminado(combate) &&
      !!combate.ganador &&
      combate.ganador === this.nombreRobot(combate, lado)
    );
  }

  grupo(combate: CombateLive): string {
    return combate.bloque
      ? combate.bloque.replace(/^Bloque\b/i, 'Grupo')
      : '—';
  }

  horario(combate: CombateLive): string {
    const valor = combate.horarioProgramado;

    if (!valor) return 'Por definir';

    const fecha = new Date(valor);

    if (!Number.isFinite(fecha.getTime())) {
      return 'Por definir';
    }

    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(fecha);
  }

  fechaEvento(): string {
    if (!this.data?.torneo.fecha) return '';

    const fecha = new Date(this.data.torneo.fecha);

    if (!Number.isFinite(fecha.getTime())) return '';

    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha);
  }

  ultimaActualizacion(): string {
    if (!this.data) return '';

    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(this.data.generadoEn));
  }

  async activarProyeccion(): Promise<void> {
    this.modoProyeccion = true;

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El diseño de proyección funciona también sin fullscreen.
    }
  }

  async salirProyeccion(): Promise<void> {
    this.modoProyeccion = false;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Permite salir del diseño de proyección de todas formas.
    }
  }

  trackCombate(
    _index: number,
    combate: CombateLive,
  ): string {
    return (
      combate.id ??
      `${combate.fase}-${combate.ronda}-${combate.bloque}-${combate.numero}`
    );
  }

  private validarSeleccion(): void {
    if (!this.fases.includes(this.faseSeleccionada)) {
      const faseActual = this.data?.torneo.fase;

      this.cambiarFase(
        faseActual && this.fases.includes(faseActual)
          ? faseActual
          : this.fases[0] ?? '',
      );
    }

    if (
      this.esGrupos &&
      this.rondaSeleccionada !== '' &&
      !this.rondas.some(
        (numero) => String(numero) === this.rondaSeleccionada,
      )
    ) {
      this.rondaSeleccionada = this.rondas.length
        ? String(this.rondas[0])
        : '';

      this.pagina = 0;
    }
  }

  private ajustarPagina(): void {
    this.pagina = Math.min(
      this.pagina,
      this.totalPaginas - 1,
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}