import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { CombateService } from '../../core/services/combate.service';
import { DojoService } from '../../core/services/dojo.service';
import { RobotService } from '../../core/services/robot.service';
import { TorneoService } from '../../core/services/torneo.service';
import { Combate, EstadoCombate, FaseCombate } from '../../core/models/combate.model';
import { Dojo } from '../../core/models/dojo.model';
import { EstadoRobot, Robot } from '../../core/models/robot.model';
import { Torneo } from '../../core/models/torneo.model';
import { extractErrorMessage } from '../../core/utils/error-message.util';

@Component({
  selector: 'app-combate-extra',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './combate-extra.component.html',
  styleUrl: './combate-extra.component.scss',
})
export class CombateExtraComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly combateService = inject(CombateService);
  private readonly dojoService = inject(DojoService);
  private readonly robotService = inject(RobotService);
  private readonly torneoService = inject(TorneoService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly EstadoRobot = EstadoRobot;

  // ---- Datos ----
  readonly torneos = signal<Torneo[]>([]);
  readonly robots = signal<Robot[]>([]);
  readonly dojos = signal<Dojo[]>([]);
  readonly extras = signal<Combate[]>([]);
  readonly loading = signal(true);
  readonly loadingExtras = signal(false);

  // ---- Formulario ----
  readonly torneoId = signal('');
  readonly robot1Id = signal<string | null>(null);
  readonly robot2Id = signal<string | null>(null);
  readonly busqueda1 = signal('');
  readonly busqueda2 = signal('');
  readonly dojoId = signal('');
  readonly horario = signal('');
  readonly observaciones = signal('');

  // ---- Estado de envío ----
  readonly saving = signal(false);
  readonly error = signal('');
  readonly creado = signal<Combate | null>(null);

  readonly robot1 = computed(() => this.robots().find((r) => r._id === this.robot1Id()) ?? null);
  readonly robot2 = computed(() => this.robots().find((r) => r._id === this.robot2Id()) ?? null);

  /** El robot elegido en el otro lado no aparece en la lista, para evitar un robot contra sí mismo. */
  readonly lista1 = computed(() => this.filtrar(this.busqueda1(), this.robot2Id()));
  readonly lista2 = computed(() => this.filtrar(this.busqueda2(), this.robot1Id()));

  readonly puedeCrear = computed(
    () => !!this.torneoId() && !!this.robot1Id() && !!this.robot2Id() && !this.saving(),
  );

  ngOnInit(): void {
    const torneoInicial = this.route.snapshot.queryParamMap.get('torneo') ?? '';

    this.torneoService.findAll().subscribe({
      next: (data) => {
        this.torneos.set(data);
        const inicial = data.find((t) => t._id === torneoInicial) ?? (data.length === 1 ? data[0] : null);
        if (inicial) this.seleccionarTorneo(inicial._id);
      },
    });

    this.robotService.findAll().subscribe({
      next: (data) => {
        this.robots.set([...data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'No se pudieron cargar los robots.'));
        this.loading.set(false);
      },
    });

    this.dojoService.findAll().subscribe({ next: (data) => this.dojos.set(data) });
  }

  private filtrar(termino: string, excluirId: string | null): Robot[] {
    const q = termino.trim().toLowerCase();
    return this.robots().filter((r) => {
      if (r._id === excluirId) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        this.equipoNombre(r).toLowerCase().includes(q) ||
        this.categoriaNombre(r).toLowerCase().includes(q)
      );
    });
  }

  seleccionarTorneo(id: string): void {
    this.torneoId.set(id);
    this.creado.set(null);
    this.error.set('');
    this.cargarExtras();
  }

  elegir(lado: 1 | 2, robot: Robot): void {
    (lado === 1 ? this.robot1Id : this.robot2Id).set(robot._id);
    this.error.set('');
  }

  quitar(lado: 1 | 2): void {
    (lado === 1 ? this.robot1Id : this.robot2Id).set(null);
  }

  intercambiar(): void {
    const a = this.robot1Id();
    this.robot1Id.set(this.robot2Id());
    this.robot2Id.set(a);
  }

  crear(): void {
    if (!this.puedeCrear()) return;

    const horario = this.horario();
    const fecha = horario ? new Date(horario) : null;
    if (fecha && Number.isNaN(fecha.getTime())) {
      this.error.set('El horario no es válido.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.creado.set(null);

    this.combateService
      .crearCombateExtra(this.torneoId(), {
        robot1Id: this.robot1Id()!,
        robot2Id: this.robot2Id()!,
        dojoId: this.dojoId() || undefined,
        horarioProgramado: fecha ? fecha.toISOString() : undefined,
        observaciones: this.observaciones().trim() || undefined,
      })
      .subscribe({
        next: (combate) => {
          this.creado.set(combate);
          this.saving.set(false);
          this.robot1Id.set(null);
          this.robot2Id.set(null);
          this.busqueda1.set('');
          this.busqueda2.set('');
          this.observaciones.set('');
          this.horario.set('');
          this.dojoId.set('');
          this.cargarExtras();
        },
        error: (err) => {
          this.error.set(extractErrorMessage(err, 'No se pudo crear el combate extra.'));
          this.saving.set(false);
        },
      });
  }

  private cargarExtras(): void {
    const torneo = this.torneoId();
    if (!torneo) {
      this.extras.set([]);
      return;
    }
    this.loadingExtras.set(true);
    this.combateService.findByTorneo(torneo, { fase: FaseCombate.COMBATE_EXTRA }).subscribe({
      next: (data) => {
        this.extras.set([...data].sort((a, b) => a.numero - b.numero));
        this.loadingExtras.set(false);
      },
      error: () => this.loadingExtras.set(false),
    });
  }

  equipoNombre(robot: Robot | null | undefined): string {
    const equipo = robot?.equipo;
    return typeof equipo === 'string' ? '' : equipo?.nombre ?? '';
  }

  categoriaNombre(robot: Robot | null | undefined): string {
    const categoria = robot?.categoria;
    return typeof categoria === 'string' ? '' : categoria?.nombre ?? '';
  }

  estadoRobotBadge(estado: EstadoRobot): string {
    return estado === EstadoRobot.ACTIVO ? 'badge--success' : 'badge--warning';
  }

  estadoCombateBadge(estado: EstadoCombate): string {
    switch (estado) {
      case EstadoCombate.FINALIZADO:
        return 'badge--success';
      case EstadoCombate.EN_CURSO:
        return 'badge--info';
      default:
        return 'badge--neutral';
    }
  }
}
