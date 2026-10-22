import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  of,
  switchMap,
  timer,
} from 'rxjs';

import { LiveUserMenuComponent } from '../live-user-menu/live-user-menu.component';
import { CombateLive, LiveData } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';
import { RobotFichaDialogService } from '../../core/services/robot-ficha-dialog.service';

const POLL_MS = 5_000;
const ESTADO_FINAL = 'Finalizado';
const ESTADO_EN_CURSO = 'En curso';
const ESTADO_PENDIENTE = 'Pendiente';

interface RobotSeguimiento {
  id: string;
  numero: number | null;
  nombre: string;
}

interface GrupoDia {
  fecha: string;
  combates: CombateLive[];
}

const norm = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
  error: string | null = null;
  seguimientoError: string | null = null;
  busca = '';
  horaActual = new Date();
  ultimaActualizacion: Date | null = null;
  segundosDesdeActualizacion = 0;
  robotsSeguidos: RobotSeguimiento[] = [];

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private api: PublicApiService,
    private readonly fichaDialog: RobotFichaDialogService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Torneo no disponible';
      return;
    }
    this.id = id;
    this.cargarSeguimiento();

    const visible$ = merge(
      of(!document.hidden),
      fromEvent(document, 'visibilitychange').pipe(
        map(() => !document.hidden),
      ),
    ).pipe(distinctUntilChanged());

    this.subs.add(
      visible$
        .pipe(
          switchMap((visible) =>
            visible ? timer(0, POLL_MS) : EMPTY,
          ),
          switchMap(() =>
            this.api.getLive(id).pipe(
              catchError((err) => {
                this.error =
                  err?.status === 404
                    ? 'Torneo no disponible'
                    : 'Sin conexión, reintentando…';
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((data) => {
          this.data = data;
          this.actualizarNombresSeguidos(data);
          this.error = null;
          this.ultimaActualizacion = new Date();
          this.segundosDesdeActualizacion = 0;
        }),
    );

    this.subs.add(
      timer(0, 1_000).subscribe(() => {
        this.horaActual = new Date();
        if (this.ultimaActualizacion) {
          this.segundosDesdeActualizacion = Math.floor(
            (Date.now() - this.ultimaActualizacion.getTime()) / 1_000,
          );
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get robotsCoincidentes(): LiveData['robots'] {
    const query = norm(this.busca.trim().replace(/^#/, ''));
    if (!query || !this.data) return [];
    return this.data.robots
      .filter((robot) => {
        const numero = robot.numero === null ? '' : String(robot.numero);
        const paddedNumero = this.numeroLabel(robot.numero);
        return norm(`${numero} ${paddedNumero} ${robot.nombre}`).includes(query);
      })
      .slice(0, 8);
  }

  get misCombates(): CombateLive[] {
    const ids = new Set(this.robotsSeguidos.map((robot) => robot.id));
    if (ids.size === 0) return [];
    return (this.data?.combates ?? []).filter((combate) =>
      combate.robotsDetalle.some((robot) => robot.id && ids.has(robot.id)),
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

  get gruposDia(): GrupoDia[] {
    const grupos = new Map<string, CombateLive[]>();
    for (const combate of this.data?.combates ?? []) {
      const fecha =
        combate.horarioProgramado?.slice(0, 10) ??
        combate.horaEstimada?.slice(0, 10) ??
        this.data?.torneo.fecha?.slice(0, 10) ??
        'Agenda del torneo';
      const actuales = grupos.get(fecha) ?? [];
      actuales.push(combate);
      grupos.set(fecha, actuales);
    }
    return [...grupos.entries()].map(([fecha, combates]) => ({
      fecha,
      combates,
    }));
  }

  terminado(combate: CombateLive): boolean {
    return combate.estado === ESTADO_FINAL;
  }

  seguirRobot(robot: LiveData['robots'][number]): void {
    if (this.robotsSeguidos.some((actual) => actual.id === robot.id)) return;
    this.robotsSeguidos = [
      ...this.robotsSeguidos,
      { id: robot.id, numero: robot.numero, nombre: robot.nombre },
    ].sort((a, b) => (a.numero ?? Number.MAX_SAFE_INTEGER) - (b.numero ?? Number.MAX_SAFE_INTEGER));
    this.busca = '';
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

  record(robot: RobotSeguimiento): { victorias: number; derrotas: number } {
    const terminados = this.misCombates.filter(
      (combate) =>
        this.terminado(combate) &&
        combate.robotsDetalle.some((detalle) => detalle.id === robot.id) &&
        !combate.empate,
    );
    const victorias = terminados.filter(
      (combate) =>
        (robot.numero !== null && combate.ganadorNumero === robot.numero) ||
        (combate.ganadorNumero == null && combate.ganador === robot.nombre),
    ).length;
    return { victorias, derrotas: terminados.length - victorias };
  }

  abrirFicha(robot: CombateLive['robotsDetalle'][number]): void {
    if (!robot.id) return;
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

  fechaDeGrupo(fecha: string): Date | null {
    return fecha === 'Agenda del torneo' ? null : new Date(`${fecha}T12:00:00`);
  }

  trackGrupo(_: number, grupo: GrupoDia): string {
    return grupo.fecha;
  }

  trackCombate(_: number, combate: CombateLive): string {
    return `${combate.fase}-${combate.bloque}-${combate.dojo}-${combate.numero}`;
  }

  trackRobot(_: number, robot: RobotSeguimiento): string {
    return robot.id;
  }

  private cargarSeguimiento(): void {
    try {
      const raw = localStorage.getItem(this.claveSeguimiento());
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.seguimientoError = 'No se pudo leer la lista guardada de robots.';
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
