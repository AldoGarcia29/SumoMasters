import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { EventoConfigService } from '../../core/services/evento-config.service';
import { EventoConfig } from '../../core/models/evento-config.model';
import { Title } from '@angular/platform-browser';

const POLL_MS = 5_000;

@Component({
  selector: 'app-live-torneo',
  standalone: true,
  imports: [CommonModule, RouterLink, LiveUserMenuComponent],
  templateUrl: './live-torneo.component.html',
  styleUrls: ['./live-torneo.component.css'],
})
export class LiveTorneoComponent implements OnInit, OnDestroy {
  id = '';
  data: LiveData | null = null;
  error: string | null = null;
  eventoConfig: EventoConfig | null = null;
  eventoConfigError: string | null = null;
  horaActual = new Date();
  ultimaActualizacion: Date | null = null;
  segundosDesdeActualizacion = 0;

  private subs = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private api: PublicApiService,
    private readonly fichaDialog: RobotFichaDialogService,
    private readonly eventoConfigService: EventoConfigService,
    private readonly title: Title,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.eventoConfigService.obtener().subscribe({
        next: (config) => {
          this.eventoConfig = config;
          this.eventoConfigError = null;
          this.actualizarTitulo();
        },
        error: () => {
          this.eventoConfigError = 'No se pudo cargar la identidad del evento.';
        },
      }),
    );

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Torneo no disponible';
      return;
    }
    this.id = id;

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
          this.actualizarTitulo();
          this.ultimaActualizacion = new Date();
          this.segundosDesdeActualizacion = 0;
          this.error = null;
        }),
    );

    this.subs.add(
      timer(1_000, 1_000).subscribe(() => {
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

  private actualizarTitulo(): void {
    const nombreEvento = this.eventoConfig?.nombreEvento ?? 'En vivo';
    this.title.setTitle(
      this.data
        ? `${nombreEvento} | ${this.data.torneo.nombre}`
        : `${nombreEvento} | En vivo`,
    );
  }

  get enCurso(): CombateLive[] {
    return (this.data?.combates ?? []).filter(
      (combate) => combate.estado === 'En curso',
    );
  }

  get siguientes(): CombateLive[] {
    return (this.data?.combates ?? [])
      .filter((combate) => combate.estado === 'Pendiente')
      .slice(0, 12);
  }

  get resultados(): CombateLive[] {
    return (this.data?.combates ?? [])
      .filter((combate) => combate.estado === 'Finalizado')
      .slice()
      .reverse();
  }

  get llave(): { fase: string; combates: CombateLive[] }[] {
    const fases = new Map<string, CombateLive[]>();
    for (const combate of this.data?.combates ?? []) {
      if (!combate.fase || combate.fase === 'Fase de grupos') continue;
      const lista = fases.get(combate.fase) ?? [];
      lista.push(combate);
      fases.set(combate.fase, lista);
    }
    return [...fases.entries()].map(([fase, combates]) => ({
      fase,
      combates,
    }));
  }

  abrirFicha(robotId: string | null, numero: number | null): void {
    if (!robotId) return;
    this.fichaDialog.open({
      torneoId: this.id,
      robotId,
      numero,
      publico: true,
    });
  }

  numeroLabel(numero: number | null): string {
    return numero === null ? '---' : String(numero).padStart(3, '0');
  }

  cuentaRegresiva(hora: string): string {
    const segundos = Math.max(
      0,
      Math.floor((new Date(hora).getTime() - Date.now()) / 1_000),
    );
    if (segundos < 60) return `en ${segundos}s`;
    if (segundos < 3_600) return `en ${Math.floor(segundos / 60)} min`;
    return `en ${Math.floor(segundos / 3_600)} h ${Math.floor((segundos % 3_600) / 60)} min`;
  }

  trackCombate(_: number, combate: CombateLive): number {
    return combate.numero;
  }

  trackRobot(_: number, robot: { id: string }): string {
    return robot.id;
  }

  trackGrupo(_: number, grupo: { nombre: string }): string {
    return grupo.nombre;
  }
}
