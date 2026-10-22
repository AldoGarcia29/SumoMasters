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

const POLL_MS = 5_000;
const ROTACION_MS = 15_000;
const ESTADO_FINAL = 'Finalizado';
const ESTADO_EN_CURSO = 'En curso';
const ESTADO_PENDIENTE = 'Pendiente';

interface RobotSeguimiento {
  id: string;
  numero: number | null;
  nombre: string;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Component({
  selector: 'app-live-combates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LiveUserMenuComponent],
  templateUrl: './live-combates.component.html',
  styleUrls: ['./live-combates.component.css'],
})
export class LiveCombatesComponent implements OnInit, OnDestroy {
  id = '';
  data: LiveData | null = null;
  torneos: TorneoResumen[] = [];
  error: string | null = null;
  aviso: string | null = null;
  seguimientoError: string | null = null;
  cargando = true;

  faseSeleccionada = '';
  rondaSeleccionada = '';
  busca = '';
  buscaSeguimiento = '';
  soloPendientes = false;
  horaActual = new Date();
  actualizadoEn: Date | null = null;
  segundosDesdeActualizacion = 0;
  robotsSeguidos: RobotSeguimiento[] = [];

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
    private readonly fichaDialog: RobotFichaDialogService,
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
            this.error = null;
            this.cargando = true;
            this.faseSeleccionada = '';
            this.rondaSeleccionada = '';
            this.busca = '';
            this.buscaSeguimiento = '';
            this.soloPendientes = false;
            this.pagina = 0;
            this.fotosFallidas.clear();
            this.actualizadoEn = null;
            this.cargarSeguimiento();

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
                            this.error =
                              err?.status === 404
                                ? 'El torneo no existe o no está disponible al público.'
                                : 'Sin conexión. Los datos pueden estar desactualizados; reintentando…';
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
          this.actualizarNombresSeguidos(data);
          this.error = null;
          this.cargando = false;
          this.actualizadoEn = new Date();
          this.segundosDesdeActualizacion = 0;
          this.validarSeleccion();
          this.ajustarPagina();
        }),
    );

    this.subs.add(
      timer(0, 1_000).subscribe(() => {
        this.horaActual = new Date();
        if (this.actualizadoEn) {
          this.segundosDesdeActualizacion = Math.floor(
            (Date.now() - this.actualizadoEn.getTime()) / 1_000,
          );
        }
      }),
    );

    this.subs.add(
      timer(ROTACION_MS, ROTACION_MS).subscribe(() => {
        if (this.rotacionAutomatica && this.totalPaginas > 1) {
          this.pagina = (this.pagina + 1) % this.totalPaginas;
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
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
      ...[...disponibles].filter((fase) => !conocidas.includes(fase)),
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

  get robotsCoincidentes(): LiveData['robots'] {
    const consulta = normalizar(
      this.buscaSeguimiento.trim().replace(/^#/, ''),
    );
    if (!consulta || !this.data) return [];
    return this.data.robots
      .filter((robot) =>
        normalizar(
          `${robot.numero ?? ''} ${this.numeroLabel(robot.numero)} ${robot.nombre}`,
        ).includes(consulta),
      )
      .slice(0, 8);
  }

  get misCombates(): CombateLive[] {
    const ids = new Set(this.robotsSeguidos.map((robot) => robot.id));
    if (!ids.size) return [];
    return (this.data?.combates ?? []).filter((combate) =>
      combate.robotsDetalle.some(
        (robot) => robot.id !== null && ids.has(robot.id),
      ),
    );
  }

  get proximoCombate(): CombateLive | undefined {
    return this.misCombates.find((combate) => !this.terminado(combate));
  }

  get siguienteGeneral(): CombateLive | undefined {
    return this.data?.combates.find(
      (combate) => combate.estado === ESTADO_PENDIENTE,
    );
  }

  get filtrados(): CombateLive[] {
    const consulta = normalizar(this.busca.trim().replace(/^#/, ''));

    return (this.data?.combates ?? [])
      .filter((combate) => {
        if ((combate.fase || 'Sin fase') !== this.faseSeleccionada) {
          return false;
        }
        if (
          this.esGrupos &&
          this.rondaSeleccionada !== '' &&
          String(combate.ronda ?? 0) !== this.rondaSeleccionada
        ) {
          return false;
        }
        if (this.soloPendientes && this.terminado(combate)) return false;
        if (consulta) {
          const coincideRobot = combate.robotsDetalle.some((robot) =>
            normalizar(
              `${robot.numero ?? ''} ${this.numeroLabel(robot.numero)} ${robot.nombre}`,
            ).includes(consulta),
          );
          if (!coincideRobot) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const porRonda = this.esGrupos
          ? (a.ronda ?? 0) - (b.ronda ?? 0)
          : 0;
        if (porRonda) return porRonda;
        if (this.esGrupos) {
          const grupoA = a.bloque ?? '';
          const grupoB = b.bloque ?? '';
          const porGrupo =
            grupoA.length - grupoB.length ||
            grupoA.localeCompare(grupoB, 'es', { numeric: true });
          if (porGrupo) return porGrupo;
        }
        return a.numero - b.numero;
      });
  }

  get visibles(): CombateLive[] {
    const inicio = this.pagina * this.porPagina;
    return this.filtrados.slice(inicio, inicio + this.porPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
  }

  get tituloRonda(): string {
    if (!this.esGrupos) return '';
    if (this.rondaSeleccionada === '') return 'Todas las rondas';
    return this.rondaSeleccionada === '0'
      ? 'Sin ronda registrada'
      : `Ronda ${this.rondaSeleccionada}`;
  }

  get cantidadEnCurso(): number {
    return (this.data?.combates ?? []).filter(
      (combate) => combate.estado === ESTADO_EN_CURSO,
    ).length;
  }

  seguirRobot(robot: LiveData['robots'][number]): void {
    if (this.robotsSeguidos.some((actual) => actual.id === robot.id)) return;
    this.robotsSeguidos = [
      ...this.robotsSeguidos,
      { id: robot.id, numero: robot.numero, nombre: robot.nombre },
    ].sort(
      (a, b) =>
        (a.numero ?? Number.MAX_SAFE_INTEGER) -
        (b.numero ?? Number.MAX_SAFE_INTEGER),
    );
    this.buscaSeguimiento = '';
    this.guardarSeguimiento();
  }

  dejarDeSeguir(robotId: string): void {
    this.robotsSeguidos = this.robotsSeguidos.filter(
      (robot) => robot.id !== robotId,
    );
    this.guardarSeguimiento();
  }

  esSeguido(robotId: string): boolean {
    return this.robotsSeguidos.some((robot) => robot.id === robotId);
  }

  record(robot: RobotSeguimiento): { victorias: number; derrotas: number } {
    const terminados = this.misCombates.filter(
      (combate) =>
        this.terminado(combate) &&
        combate.robotsDetalle.some((detalle) => detalle.id === robot.id) &&
        !combate.empate,
    );
    const victorias = terminados.filter(
      (combate) =>
        (robot.numero !== null &&
          combate.ganadorNumero === robot.numero) ||
        (combate.ganadorNumero == null &&
          combate.ganador === robot.nombre),
    ).length;
    return { victorias, derrotas: terminados.length - victorias };
  }

  estadoProximo(combate: CombateLive): string {
    if (combate.estado === ESTADO_EN_CURSO) return 'En curso';
    if (combate.dojo && combate.combatesAntes === 0) {
      return `Dirígete al Dojo ${combate.dojo}`;
    }
    if (
      combate.horaEstimada &&
      new Date(combate.horaEstimada).getTime() - Date.now() <= 15 * 60_000
    ) {
      return 'Prepárate';
    }
    return 'Programado';
  }

  estadoTimeline(combate: CombateLive): string {
    if (this.terminado(combate)) return ESTADO_FINAL;
    if (combate.estado === ESTADO_EN_CURSO) return ESTADO_EN_CURSO;
    if (combate === this.siguienteGeneral || combate === this.proximoCombate) {
      return 'Próximo';
    }
    return 'Programado';
  }

  cuentaRegresiva(hora: string | null): string {
    if (!hora) return 'Horario por confirmar';
    const segundos = Math.max(
      0,
      Math.floor((new Date(hora).getTime() - Date.now()) / 1_000),
    );
    if (segundos < 60) return `En ${segundos} s`;
    if (segundos < 3_600) return `En ${Math.floor(segundos / 60)} min`;
    return `En ${Math.floor(segundos / 3_600)} h ${Math.floor((segundos % 3_600) / 60)} min`;
  }

  cambiarTorneo(id: string): void {
    if (!id || id === this.id) return;
    void this.router.navigate(['/live', id, 'combates']);
  }

  cambiarFase(fase: string): void {
    this.faseSeleccionada = fase;
    this.rondaSeleccionada =
      this.esGrupos && this.rondas.length ? String(this.rondas[0]) : '';
    this.reiniciarPagina();
  }

  reiniciarPagina(): void {
    this.pagina = 0;
  }

  anterior(): void {
    this.pagina = Math.max(0, this.pagina - 1);
  }

  siguiente(): void {
    this.pagina = Math.min(this.totalPaginas - 1, this.pagina + 1);
  }

  async activarProyeccion(): Promise<void> {
    this.modoProyeccion = true;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      this.aviso = 'No fue posible activar pantalla completa; la proyección sigue disponible.';
    }
  }

  async salirProyeccion(): Promise<void> {
    this.modoProyeccion = false;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      this.aviso = 'No fue posible salir de pantalla completa desde el navegador.';
    }
  }

  terminado(combate: CombateLive): boolean {
    return combate.estado === ESTADO_FINAL;
  }

  nombreRobot(combate: CombateLive, lado: 1 | 2): string {
    const detalle = combate.robotsDetalle[lado - 1];
    const participante = lado === 1 ? combate.robot1 : combate.robot2;
    return participante?.nombre || detalle?.nombre || 'Por definir';
  }

  numeroRobot(combate: CombateLive, lado: 1 | 2): number | null {
    return combate.robotsDetalle[lado - 1]?.numero ?? null;
  }

  detalleRobot(combate: CombateLive, lado: 1 | 2): RobotDetalleLive | null {
    const detalle = combate.robotsDetalle[lado - 1];
    return detalle?.id ? detalle : null;
  }

  fotoRobot(combate: CombateLive, lado: 1 | 2): string | null {
    const robot = lado === 1 ? combate.robot1 : combate.robot2;
    const imagen = robot?.imagenUrl;
    return imagen && !this.fotosFallidas.has(imagen) ? imagen : null;
  }

  marcarFotoFallida(url: string): void {
    this.fotosFallidas.add(url);
  }

  ganador(combate: CombateLive, lado: 1 | 2): boolean {
    const numero = this.numeroRobot(combate, lado);
    return (
      this.terminado(combate) &&
      !!combate.ganador &&
      ((numero !== null && numero === combate.ganadorNumero) ||
        combate.ganador === this.nombreRobot(combate, lado))
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
    if (!Number.isFinite(fecha.getTime())) return 'Por definir';
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

  ultimaActualizacionLabel(): string {
    if (!this.actualizadoEn) return '';
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(this.actualizadoEn);
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
    return numero === null ? '---' : String(numero).padStart(3, '0');
  }

  trackCombate(_index: number, combate: CombateLive): string {
    return combate.id;
  }

  trackRobot(_index: number, robot: RobotSeguimiento): string {
    return robot.id;
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
    this.pagina = Math.min(this.pagina, this.totalPaginas - 1);
  }

  private cargarSeguimiento(): void {
    this.seguimientoError = null;
    try {
      const raw = localStorage.getItem(this.claveSeguimiento());
      if (!raw) {
        this.robotsSeguidos = [];
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.robotsSeguidos = [];
        this.seguimientoError =
          'No se pudo leer la lista guardada de robots.';
        return;
      }
      this.robotsSeguidos = parsed.filter(
        (item): item is RobotSeguimiento =>
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          typeof item.id === 'string' &&
          'nombre' in item &&
          typeof item.nombre === 'string' &&
          'numero' in item &&
          (typeof item.numero === 'number' || item.numero === null),
      );
    } catch {
      this.robotsSeguidos = [];
      this.seguimientoError =
        'No se pudo leer el seguimiento local. Revisa el almacenamiento del navegador.';
    }
  }

  private guardarSeguimiento(): void {
    try {
      localStorage.setItem(
        this.claveSeguimiento(),
        JSON.stringify(this.robotsSeguidos),
      );
      this.seguimientoError = null;
    } catch {
      this.seguimientoError =
        'No se pudo guardar el seguimiento. Revisa el espacio disponible del navegador.';
    }
  }

  private actualizarNombresSeguidos(data: LiveData): void {
    const actualizados = this.robotsSeguidos.map((seguido) => {
      const robot = data.robots.find((actual) => actual.id === seguido.id);
      return robot
        ? { id: robot.id, numero: robot.numero, nombre: robot.nombre }
        : seguido;
    });
    const cambio = actualizados.some(
      (robot, index) =>
        robot.numero !== this.robotsSeguidos[index].numero ||
        robot.nombre !== this.robotsSeguidos[index].nombre,
    );
    this.robotsSeguidos = actualizados;
    if (cambio) this.guardarSeguimiento();
  }

  private claveSeguimiento(): string {
    return `sumomasters_live_robots_${this.id}`;
  }
}
