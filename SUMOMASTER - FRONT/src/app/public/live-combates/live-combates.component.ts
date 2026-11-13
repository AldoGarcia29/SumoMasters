import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subscription,
  combineLatest,
  catchError,
  distinctUntilChanged,
  exhaustMap,
  fromEvent,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';

import { FaseCombate } from '../../core/models/combate.model';
import { RobotFichaDialogService } from '../../core/services/robot-ficha-dialog.service';
import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import {
  CombateLive,
  LiveData,
  RobotDetalleLive,
  TorneoResumen,
} from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';
import { RoboSoccerProyeccionComponent } from './robo-soccer-proyeccion.component';
import { RankingSeguilineas, formatearTiempo } from '../../core/models/seguilineas.model';
import { SeguilineasService } from '../../core/services/seguilineas.service';

const TICKER_MS = 30_000;
const LOGO_PATROCINADOR = '/image_75528b.png';

type TickerTipo = 'recientes' | 'top3' | 'patrocinador';
interface TickerItem { texto?: string; logo?: string; }
interface TickerVista { tipo: TickerTipo; etiqueta: string; pista: TickerItem[]; duracionS: number; }


interface DojoPantalla {
  numero: number;
  actual: CombateLive | null;
  siguiente: CombateLive | null;
  etapa: 'espera' | 'entrada' | 'combate' | 'resultado' | 'salida';
  hasta: number;
}

const POLL_MS = 5_000;
const ROTACION_MS = 15_000;
const ESTADO_FINAL = 'Finalizado';
const ESTADO_EN_CURSO = 'En curso';

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
    RoboSoccerProyeccionComponent,
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

  horaActual = new Date();
  actualizadoEn: Date | null = null;
  segundosDesdeActualizacion = 0;

  modoProyeccion = false;
  rotacionAutomatica = false;
  pagina = 0;
  readonly porPagina = 4;

  vistaProyeccion: 'arena' | 'bloques' | 'roboSoccer' = 'arena';
  torneoSoccerId = '';
  readonly opcionesDojos = [1, 2, 3, 4, 5];
  dojosSeleccionados = [1, 2, 3, 4, 5];
  dojosPantalla: DojoPantalla[] = [];

  private ultimoAvance = Date.now();
  private readonly subs = new Subscription();
  private readonly fotosFallidas = new Set<string>();

  private readonly seguilineasApi = inject(SeguilineasService);
  private readonly seguilineas$ = new BehaviorSubject<RankingSeguilineas | null>(null);

  /** Emite un nuevo estado del ticker cada 30 s (y re-emite el mismo estado si cambian los datos). */
  readonly ticker$: Observable<TickerVista> = combineLatest([
    timer(0, TICKER_MS),
    this.seguilineas$.pipe(distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))),
  ]).pipe(
    map(([tick, s]) => {
      const ciclo = this.cicloTicker(s);
      return ciclo[tick % ciclo.length];
    }),
  );

  trackTicker = (i: number): number => i;

  private cicloTicker(s: RankingSeguilineas | null): TickerVista[] {
    const vistas: TickerVista[] = [];
    const medallas = ['🥇', '🥈', '🥉'];

    if (s?.recientes.length) {
      vistas.push(this.armarVista('recientes', 'ÚLTIMOS TIEMPOS',
        s.recientes.map((r) => ({ texto: `⏱ ${r.nombre} · ${formatearTiempo(r.tiempoMs)}` }))));
    }
    if (s?.top3.length) {
      vistas.push(this.armarVista('top3', `TOP 3 · ${s.nombre.toUpperCase()}`,
        s.top3.map((f, i) => ({ texto: `${medallas[i]} ${f.nombre} · ${formatearTiempo(f.mejorTiempoMs)}` }))));
    }
    // Siempre parte del ciclo; es el único estado cuando no hay datos.
    vistas.push(this.armarVista('patrocinador', 'PATROCINADOR', [{ logo: LOGO_PATROCINADOR }]));
    return vistas;
  }

  /** Repite los items hasta cubrir el ancho y duplica la pista para un bucle sin saltos (-50 %). */
  private armarVista(tipo: TickerTipo, etiqueta: string, items: TickerItem[]): TickerVista {
    let base = items;
    while (base.length < 6) base = [...base, ...items];
    return { tipo, etiqueta, pista: [...base, ...base], duracionS: Math.max(20, base.length * 5) };
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: PublicApiService,
    private readonly fichaDialog: RobotFichaDialogService,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      timer(0, 10_000)
        .pipe(exhaustMap(() => this.seguilineasApi.activo().pipe(catchError(() => of(null)))))
        .subscribe((s) => this.seguilineas$.next(s)),
    );

    this.subs.add(
      fromEvent(document, 'fullscreenchange').subscribe(() => {
        if (!document.fullscreenElement) {
          this.modoProyeccion = false;
        }
      }),
    );

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

    const visible$ = merge(
      of(!document.hidden),
      fromEvent(document, 'visibilitychange').pipe(
        map(() => !document.hidden),
      ),
    ).pipe(distinctUntilChanged());

    this.subs.add(
      this.route.paramMap
        .pipe(
          map((params) => params.get('id') ?? ''),
          distinctUntilChanged(),
          switchMap((id) => {
            this.id = id;
            this.data = null;
            this.dojosPantalla = [];
            this.error = null;
            this.cargando = true;

            this.faseSeleccionada = '';
            this.rondaSeleccionada = '';
            this.busca = '';
            this.soloPendientes = false;
            this.pagina = 0;

            this.fotosFallidas.clear();
            this.actualizadoEn = null;
            this.segundosDesdeActualizacion = 0;

            if (!id) {
              this.cargando = false;
              this.error = 'Torneo no disponible.';
              return EMPTY;
            }

            return visible$.pipe(
              switchMap((visible) =>
                visible
                  ? timer(0, POLL_MS).pipe(
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
                    )
                  : EMPTY,
              ),
            );
          }),
        )
        .subscribe((data) => {
          this.data = data;
          this.error = null;
          this.cargando = false;
          this.actualizadoEn = new Date();
          this.segundosDesdeActualizacion = 0;

          this.validarSeleccion();
          this.ajustarPagina();
          this.sincronizarDojos();
        }),
    );

    this.subs.add(
      timer(0, 1_000).subscribe(() => {
        this.horaActual = new Date();
        this.avanzarDojos();

        if (this.actualizadoEn) {
          this.segundosDesdeActualizacion = Math.floor(
            (Date.now() - this.actualizadoEn.getTime()) / 1_000,
          );
        }
      }),
    );

    this.subs.add(
      timer(ROTACION_MS, ROTACION_MS).subscribe(() => {
        if (
          !document.hidden &&
          !this.modoProyeccion &&
          this.rotacionAutomatica &&
          this.totalPaginas > 1
        ) {
          this.pagina = (this.pagina + 1) % this.totalPaginas;
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // Se usan las asignaciones reales publicadas por el torneo, no datos de ejemplo.
  get bloquesProyeccion(): { nombre: string; robots: { id: string; numero: number | null; nombre: string; imagenUrl: string | null }[] }[] {
    const robots = this.data?.robots ?? [];
    const grupos = new Map<string, typeof robots>();
    for (const robot of robots) {
      if (!robot.grupo) continue;
      const nombre = robot.grupo;
      if (!grupos.has(nombre)) grupos.set(nombre, []);
      grupos.get(nombre)!.push(robot);
    }
    const fotos = new Map<string, string>();
    for (const combate of this.data?.combates ?? []) {
      for (const lado of [1, 2] as const) {
        const detalle = combate.robotsDetalle?.[lado - 1];
        const imagen = (lado === 1 ? combate.robot1 : combate.robot2)?.imagenUrl;
        if (detalle?.id && imagen) fotos.set(detalle.id, imagen);
      }
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
      .map(([nombre, integrantes]) => ({
        nombre,
        robots: integrantes.map(r => ({
          id: r.id,
          numero: r.numero,
          nombre: r.nombre,
          imagenUrl: fotos.get(r.id) ?? null,
        })),
      }));
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
    const consulta = normalizar(
      this.busca.trim().replace(/^#/, ''),
    );

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
          String(combate.ronda ?? 0) !== this.rondaSeleccionada
        ) {
          return false;
        }

        if (this.soloPendientes && this.terminado(combate)) {
          return false;
        }

        if (consulta) {
          const coincideRobot = (
            combate.robotsDetalle ?? []
          ).some((robot) =>
            normalizar(
              `${robot.numero ?? ''} ${this.numeroLabel(
                robot.numero,
              )} ${robot.nombre}`,
            ).includes(consulta),
          );

          const coincideNombre = (
            combate.robots ?? []
          ).some((nombre) =>
            normalizar(nombre).includes(consulta),
          );

          if (!coincideRobot && !coincideNombre) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (this.esGrupos) {
          const porRonda =
            (a.ronda ?? 0) - (b.ronda ?? 0);

          if (porRonda) return porRonda;

          const grupoA = a.bloque ?? '';
          const grupoB = b.bloque ?? '';

          const porGrupo =
            grupoA.length - grupoB.length ||
            grupoA.localeCompare(grupoB, 'es', {
              numeric: true,
            });

          if (porGrupo) return porGrupo;
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

  get cantidadEnCurso(): number {
    return this.filtrados.filter(
      (combate) => combate.estado === ESTADO_EN_CURSO,
    ).length;
  }

  get sinDojo(): number {
    return (this.data?.combates ?? []).filter(
      (c) =>
        !this.terminado(c) &&
        this.numeroDojo(c.dojo) === null,
    ).length;
  }

  cambiarTorneo(id: string): void {
    if (!id || id === this.id) return;

    void this.router.navigate([
      '/live',
      id,
      'combates',
    ]);
  }

  cambiarFase(fase: string): void {
    this.faseSeleccionada = fase;

    this.rondaSeleccionada =
      this.esGrupos && this.rondas.length
        ? String(this.rondas[0])
        : '';

    this.reiniciarPagina();
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

  async activarProyeccion(): Promise<void> {
    if (!this.dojosSeleccionados.length) return;

    this.sincronizarDojos();
    this.modoProyeccion = true;

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      this.aviso =
        'No fue posible activar pantalla completa; la proyección sigue disponible.';
    }
  }

  async salirProyeccion(): Promise<void> {
    this.modoProyeccion = false;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      this.aviso =
        'No fue posible salir de pantalla completa desde el navegador.';
    }
  }

  terminado(combate: CombateLive): boolean {
    return combate.estado === ESTADO_FINAL;
  }

  nombreRobot(
    combate: CombateLive,
    lado: 1 | 2,
  ): string {
    const detalle =
      combate.robotsDetalle?.[lado - 1];

    const participante =
      lado === 1 ? combate.robot1 : combate.robot2;

    return (
      participante?.nombre ||
      detalle?.nombre ||
      combate.robots?.[lado - 1] ||
      'Por definir'
    );
  }

  numeroRobot(
    combate: CombateLive,
    lado: 1 | 2,
  ): number | null {
    return (
      combate.robotsDetalle?.[lado - 1]?.numero ??
      null
    );
  }

  detalleRobot(
    combate: CombateLive,
    lado: 1 | 2,
  ): RobotDetalleLive | null {
    const detalle =
      combate.robotsDetalle?.[lado - 1];

    return detalle?.id ? detalle : null;
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

  fotoDisponible(url: string): boolean {
    return !this.fotosFallidas.has(url);
  }

  marcarFotoFallida(url: string): void {
    this.fotosFallidas.add(url);
  }

  ganador(
    combate: CombateLive,
    lado: 1 | 2,
  ): boolean {
    if (!this.terminado(combate)) return false;

    const numero = this.numeroRobot(combate, lado);

    if (combate.ganadorNumero != null) {
      return (
        numero !== null &&
        numero === combate.ganadorNumero
      );
    }

    return (
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

    // La fecha del evento se interpreta como día, sin restar horas.
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha);
  }

  ultimaActualizacionLabel(): string {
    if (!this.actualizadoEn) return '';

    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(this.actualizadoEn);
  }

  horaMexico(): string {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.horaActual);
  }

  abrirFicha(robot: RobotDetalleLive | null): void {
    if (!robot?.id) return;

    this.fichaDialog.open({
      torneoId: this.id,
      robotId: robot.id,
      numero: robot.numero,
      publico: true,
    });
  }

  numeroLabel(numero: number | null): string {
    return numero == null
      ? '---'
      : String(numero).padStart(3, '0');
  }

  trackCombate(
    _index: number,
    combate: CombateLive,
  ): string {
    return combate.id;
  }

  trackDojo(
    _index: number,
    dojo: DojoPantalla,
  ): number {
    return dojo.numero;
  }

  seleccionarDojo(
    numero: number,
    seleccionado: boolean,
  ): void {
    this.dojosSeleccionados = seleccionado
      ? [...new Set([...this.dojosSeleccionados, numero])]
          .sort((a, b) => a - b)
      : this.dojosSeleccionados.filter((n) => n !== numero);

    this.sincronizarDojos();
  }

  private numeroDojo(valor: string): number | null {
    // Acepta "1" a "5", "Dojo 1" a "Dojo 5", o "Dojo #5".
    const coincidencia = normalizar(
      (valor || '').trim(),
    ).match(/^(?:dojo\s*#?\s*)?0*([1-5])$/);

    return coincidencia ? Number(coincidencia[1]) : null;
  }

  private colaDojo(numero: number): CombateLive[] {
    // Los filtros de la tabla no afectan a la proyección.
    return (this.data?.combates ?? [])
      .filter(
        (c) =>
          this.numeroDojo(c.dojo) === numero &&
          (
            c.estado === ESTADO_EN_CURSO ||
            c.estado === 'Pendiente'
          ),
      )
      .sort((a, b) => {
        const curso =
          Number(b.estado === ESTADO_EN_CURSO) -
          Number(a.estado === ESTADO_EN_CURSO);

        if (curso) return curso;

        const fecha = (c: CombateLive): number => {
          const t = c.horarioProgramado
            ? Date.parse(c.horarioProgramado)
            : NaN;

          return Number.isFinite(t)
            ? t
            : Number.MAX_SAFE_INTEGER;
        };

        return (
          fecha(a) - fecha(b) ||
          (a.ronda ?? 0) - (b.ronda ?? 0) ||
          a.numero - b.numero ||
          a.id.localeCompare(b.id)
        );
      });
  }

  private ponerCombate(
    d: DojoPantalla,
    c: CombateLive | null,
    ahora: number,
  ): void {
    d.actual = c;
    d.etapa = c ? 'entrada' : 'espera';
    d.hasta = c ? ahora + 700 : 0;
  }

  private sincronizarDojos(): void {
    const ahora = Date.now();

    this.dojosPantalla = this.dojosSeleccionados.map(
      (numero) => {
        const d: DojoPantalla =
          this.dojosPantalla.find(
            (item) => item.numero === numero,
          ) ?? {
            numero,
            actual: null,
            siguiente: null,
            etapa: 'espera',
            hasta: 0,
          };

        const cola = this.colaDojo(numero);

        const actualizado = d.actual
          ? this.data?.combates.find(
              (c) => c.id === d.actual?.id,
            )
          : null;

        if (
          actualizado &&
          this.numeroDojo(actualizado.dojo) === numero &&
          (
            this.terminado(actualizado) ||
            actualizado.estado === ESTADO_EN_CURSO ||
            actualizado.estado === 'Pendiente'
          )
        ) {
          d.actual = actualizado;

          if (this.terminado(actualizado)) {
            if (
              d.etapa !== 'resultado' &&
              d.etapa !== 'salida'
            ) {
              d.etapa = 'resultado';
              d.hasta = ahora + 5000;
            }
          } else if (
            d.etapa === 'resultado' ||
            d.etapa === 'salida'
          ) {
            // El juez corrigió el resultado.
            d.etapa = 'combate';
            d.hasta = 0;
          }
        } else if (d.actual) {
          // Combate eliminado, cancelado o reasignado.
          this.ponerCombate(
            d,
            cola[0] ?? null,
            ahora,
          );
        }

        if (!d.actual) {
          this.ponerCombate(
            d,
            cola[0] ?? null,
            ahora,
          );
        }

        if (
          d.actual &&
          d.etapa !== 'resultado' &&
          d.etapa !== 'salida' &&
          cola[0] &&
          cola[0].id !== d.actual.id
        ) {
          this.ponerCombate(d, cola[0], ahora);
        }

        d.siguiente =
          cola.find(
            (c) => c.id !== d.actual?.id,
          ) ?? null;

        return d;
      },
    );
  }

  private avanzarDojos(): void {
    const ahora = Date.now();

    // Pausa las transiciones mientras la pestaña está oculta.
    if (document.hidden) {
      for (const d of this.dojosPantalla) {
        if (d.hasta) {
          d.hasta += ahora - this.ultimoAvance;
        }
      }

      this.ultimoAvance = ahora;
      return;
    }

    const salto = ahora - this.ultimoAvance;
    this.ultimoAvance = ahora;

    for (const d of this.dojosPantalla) {
      if (salto > 2500 && d.hasta) {
        d.hasta += salto;
      }

      if (!d.hasta || ahora < d.hasta) {
        continue;
      }

      if (d.etapa === 'resultado') {
        d.etapa = 'salida';
        d.hasta = ahora + 700;
      } else if (d.etapa === 'salida') {
        this.ponerCombate(
          d,
          this.colaDojo(d.numero)[0] ?? null,
          ahora,
        );

        d.siguiente =
          this.colaDojo(d.numero).find(
            (c) => c.id !== d.actual?.id,
          ) ?? null;
      } else if (d.etapa === 'entrada') {
        d.etapa = 'combate';
        d.hasta = 0;
      }
    }
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
        (numero) =>
          String(numero) === this.rondaSeleccionada,
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
}