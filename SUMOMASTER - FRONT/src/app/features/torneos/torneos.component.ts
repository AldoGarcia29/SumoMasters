import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import { EquipoService } from '../../core/services/equipo.service';
import { Equipo } from '../../core/models/equipo.model';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoService } from '../../core/services/torneo.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { RobotService } from '../../core/services/robot.service';
import { EstadoTorneo, Torneo } from '../../core/models/torneo.model';
import { Categoria, TipoCombate } from '../../core/models/categoria.model';
import { Robot } from '../../core/models/robot.model';
import { CanDirective } from '../../shared/directives/can.directive';
import type { Observable } from 'rxjs';


type ModalMode = 'create' | 'edit' | 'view' | null;
type TabFilter = 'todos' | EstadoTorneo;

const PAGE_SIZE = 6;

@Component({
  selector: 'app-torneos',
  standalone: true,
  imports: [CanDirective, CommonModule, ReactiveFormsModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneos.component.html',
  styleUrl: './torneos.component.scss',
})
export class TorneosComponent implements OnInit {
  private readonly torneoService = inject(TorneoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly robotService = inject(RobotService);
  private readonly equipoService = inject(EquipoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly EstadoTorneo = EstadoTorneo;

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly estados = Object.values(EstadoTorneo);

  readonly torneos = signal<Torneo[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly robotsDisponibles = signal<Robot[]>([]);
  readonly equiposDisponibles = signal<Equipo[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly page = signal(1);

  readonly activeTab = signal<TabFilter>('todos');

  readonly filteredTorneos = computed(() => {
    const tab = this.activeTab();
    if (tab === 'todos') return this.torneos();
    return this.torneos().filter((t) => t.estado === tab);
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredTorneos().length / PAGE_SIZE)),
  );

  readonly pagedTorneos = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredTorneos().slice(start, start + PAGE_SIZE);
  });

  // ---- Modal / formulario ----
  readonly modalMode = signal<ModalMode>(null);
  readonly selectedTorneo = signal<Torneo | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly torneoToDelete = signal<Torneo | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    fecha: ['', Validators.required],
    categoria: ['', Validators.required],
    descripcion: [''],
    estado: [EstadoTorneo.PROGRAMADO, Validators.required],
    tamanioBloque: [16, [Validators.required, Validators.min(2)]],
    robotsInscritos: this.fb.nonNullable.control<string[]>([]),
    equiposInscritos: this.fb.nonNullable.control<string[]>([]),
  });

  get esRoboSoccerSeleccionado(): boolean {
    const categoriaId = this.form.controls.categoria.value;
    const seleccionada = this.selectedTorneo()?.categoria;
    const tipoCombate =
      this.categorias().find((item) => item._id === categoriaId)?.tipoCombate ??
      (seleccionada && typeof seleccionada !== 'string' && seleccionada._id === categoriaId
        ? seleccionada.tipoCombate
        : undefined);

    return tipoCombate === TipoCombate.ROBO_SOCCER_RC;
  }

  ngOnInit(): void {
    this.categoriaService.findAll().subscribe({ next: (data) => this.categorias.set(data) });
    this.loadTorneos();

    this.form.controls.categoria.valueChanges.pipe(
      switchMap((categoriaId) => {
        this.form.controls.robotsInscritos.setValue([]);
        this.form.controls.equiposInscritos.setValue([]);
        this.robotsDisponibles.set([]);
        this.equiposDisponibles.set([]);
        this.formError.set(null);

        if (!categoriaId) return EMPTY;

        const esRoboSoccer = this.esRoboSoccerSeleccionado;
        const consulta: Observable<Equipo[] | Robot[]> = esRoboSoccer
          ? this.equipoService.findAll({ categoria: categoriaId }).pipe(
              tap((equipos) => this.equiposDisponibles.set(equipos)),
            )
          : this.robotService.findAll({ categoria: categoriaId }).pipe(
              tap((robots) => this.robotsDisponibles.set(robots)),
            );

        return consulta.pipe(
          catchError(() => {
            this.formError.set(
              esRoboSoccer ? 'No se pudieron cargar los equipos.' : 'No se pudieron cargar los robots.',
            );
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  loadTorneos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.torneoService.findAll().subscribe({
      next: (data) => {
        this.torneos.set(data);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudieron cargar los torneos. Verifica que el servicio esté disponible.',
        );
        this.loading.set(false);
      },
    });
  }

  setTab(tab: TabFilter): void {
    this.activeTab.set(tab);
    this.page.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.page.set(page);
    }
  }

  // ---- Abrir modales ----
  openCreateModal(): void {
    this.formError.set(null);
    this.selectedTorneo.set(null);
    this.robotsDisponibles.set([]);
    this.form.reset({
      nombre: '',
      fecha: '',
      categoria: '',
      descripcion: '',
      estado: EstadoTorneo.PROGRAMADO,
      tamanioBloque: 16,
      robotsInscritos: [],
    });
    this.modalMode.set('create');
  }

  openEditModal(torneo: Torneo): void {
    this.formError.set(null);
    this.selectedTorneo.set(torneo);
    const categoriaId = this.categoriaId(torneo);

    this.form.reset({
      nombre: torneo.nombre,
      fecha: torneo.fecha?.substring(0, 10) ?? '',
      categoria: categoriaId,
      descripcion: torneo.descripcion ?? '',
      estado: torneo.estado,
      tamanioBloque: torneo.tamanioBloque,
    });

    this.form.controls.robotsInscritos.setValue(
      (torneo.robotsInscritos ?? []).map((robot) =>
        typeof robot === 'string' ? robot : robot._id,
      ),
    );
    this.form.controls.equiposInscritos.setValue(
      (torneo.equiposInscritos ?? []).map((equipo) =>
        typeof equipo === 'string' ? equipo : equipo._id,
      ),
    );
    this.modalMode.set('edit');
  }

  openViewModal(torneo: Torneo): void {
    this.selectedTorneo.set(torneo);
    this.modalMode.set('view');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedTorneo.set(null);
    this.formError.set(null);
  }

  toggleRobotInscrito(robotId: string, checked: boolean): void {
    const current = this.form.controls.robotsInscritos.value;
    if (checked) {
      this.form.controls.robotsInscritos.setValue([...current, robotId]);
    } else {
      this.form.controls.robotsInscritos.setValue(current.filter((id) => id !== robotId));
    }
  }

  isRobotChecked(robotId: string): boolean {
    return this.form.controls.robotsInscritos.value.includes(robotId);
  }

  toggleEquipoInscrito(equipoId: string, checked: boolean): void {
    const control = this.form.controls.equiposInscritos;
    const ids = control.value.filter((id) => id !== equipoId);
    control.setValue(checked ? [...ids, equipoId] : ids);
    control.markAsDirty();
  }

  isEquipoChecked(equipoId: string): boolean {
    return this.form.controls.equiposInscritos.value.includes(equipoId);
  }

  numeroRobotInscrito(robotId: string): number | null {
    const participante = this.selectedTorneo()?.participantes?.find((item) =>
      typeof item.robot === 'string'
        ? item.robot === robotId
        : item.robot._id === robotId,
    );
    return participante?.numero ?? null;
  }

  numeroLabel(numero: number | null): string {
    return numero === null ? '' : `#${String(numero).padStart(3, '0')} `;
  }

  todosRobotsSeleccionados(): boolean {
    const robots = this.robotsDisponibles();
    const seleccionados = this.form.controls.robotsInscritos.value;

    return robots.length > 0 && robots.every((robot) => seleccionados.includes(robot._id));
  }

  toggleTodosRobots(): void {
    const control = this.form.controls.robotsInscritos;
    control.setValue(
      this.todosRobotsSeleccionados() ? [] : this.robotsDisponibles().map((robot) => robot._id),
    );
    control.markAsDirty();
    control.markAsTouched();
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      nombre: raw.nombre.trim(),
      fecha: raw.fecha,
      categoria: raw.categoria,
      descripcion: raw.descripcion?.trim() || '',
      estado: raw.estado,
      tamanioBloque: raw.tamanioBloque,
      robotsInscritos: this.esRoboSoccerSeleccionado ? [] : raw.robotsInscritos,
      equiposInscritos: this.esRoboSoccerSeleccionado ? raw.equiposInscritos : [],
    };

    this.saving.set(true);
    this.formError.set(null);

    const current = this.selectedTorneo();
    const request =
      this.modalMode() === 'edit' && current
        ? this.torneoService.update(current._id, payload)
        : this.torneoService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadTorneos();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          extractErrorMessage(err, 'Ocurrió un error al guardar el torneo'),
        );
      },
    });
  }

  askDelete(torneo: Torneo): void {
    this.torneoToDelete.set(torneo);
  }

  cancelDelete(): void {
    this.torneoToDelete.set(null);
  }

  confirmDelete(): void {
    const torneo = this.torneoToDelete();
    if (!torneo) return;

    this.deleting.set(true);
    this.torneoService.remove(torneo._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.torneoToDelete.set(null);
        this.loadTorneos();
      },
      error: () => {
        this.deleting.set(false);
        this.torneoToDelete.set(null);
        this.errorMessage.set('No se pudo eliminar el torneo');
      },
    });
  }

  categoriaNombre(torneo: Torneo): string {
    const categoria = torneo.categoria;
    return typeof categoria === 'string' ? categoria : categoria?.nombre ?? '—';
  }

  esTorneoRoboSoccer(torneo: Torneo): boolean {
  const categoria = torneo.categoria;

  if (categoria == null) {
    return false;
  }

  const tipoCombate = typeof categoria === 'string'
    ? this.categorias().find((item) => item._id === categoria)?.tipoCombate
    : categoria.tipoCombate;

  return tipoCombate === TipoCombate.ROBO_SOCCER_RC;
}

  robotNombre(robot: Robot | string): string {
    return typeof robot === 'string' ? robot : robot.nombre;
  }

  estadoBadgeClass(estado: EstadoTorneo): string {
    switch (estado) {
      case EstadoTorneo.EN_PROGRESO:
        return 'badge--success';
      case EstadoTorneo.PROGRAMADO:
        return 'badge--info';
      default:
        return 'badge--neutral';
    }
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '—';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private categoriaId(torneo: Torneo): string {
    const categoria = torneo.categoria;
    return typeof categoria === 'string' ? categoria : categoria?._id ?? '';
  }
}
