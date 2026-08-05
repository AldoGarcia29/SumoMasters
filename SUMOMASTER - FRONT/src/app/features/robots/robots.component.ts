import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { ImageUploadComponent } from '../../shared/components/image-upload/image-upload.component';
import { RobotService } from '../../core/services/robot.service';
import { EquipoService } from '../../core/services/equipo.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoRobot, Robot } from '../../core/models/robot.model';
import { Equipo } from '../../core/models/equipo.model';
import { Categoria } from '../../core/models/categoria.model';

type ModalMode = 'create' | 'edit' | 'view' | null;

const PAGE_SIZE = 6;

@Component({
  selector: 'app-robots',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, TopbarComponent, ImageUploadComponent],
  templateUrl: './robots.component.html',
  styleUrl: './robots.component.scss',
})
export class RobotsComponent implements OnInit {
  private readonly robotService = inject(RobotService);
  private readonly equipoService = inject(EquipoService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly fb = inject(FormBuilder);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly estados = Object.values(EstadoRobot);

  readonly robots = signal<Robot[]>([]);
  readonly equipos = signal<Equipo[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly page = signal(1);

  readonly filteredRobots = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.robots();

    return this.robots().filter((robot) =>
      robot.nombre.toLowerCase().includes(term),
    );
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRobots().length / PAGE_SIZE)),
  );

  readonly pagedRobots = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredRobots().slice(start, start + PAGE_SIZE);
  });

  // ---- Modal / formulario ----
  readonly modalMode = signal<ModalMode>(null);
  readonly selectedRobot = signal<Robot | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly robotToDelete = signal<Robot | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    equipo: ['', Validators.required],
    categoria: ['', Validators.required],
    pesoKg: this.fb.control<number | null>(null),
    sinPeso: [false],
    estado: [EstadoRobot.ACTIVO, Validators.required],
    imagenUrl: this.fb.nonNullable.control<string>(''),
  });

  ngOnInit(): void {
    this.equipoService.findAll().subscribe({ next: (data) => this.equipos.set(data) });
    this.categoriaService.findAll().subscribe({ next: (data) => this.categorias.set(data) });
    this.loadRobots();
  }

  loadRobots(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.robotService.findAll().subscribe({
      next: (data) => {
        this.robots.set(data);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudieron cargar los robots. Verifica que el servicio esté disponible.',
        );
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
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
    this.selectedRobot.set(null);
    this.form.reset({
      nombre: '',
      equipo: '',
      categoria: '',
      pesoKg: null,
      sinPeso: false,
      estado: EstadoRobot.ACTIVO,
      imagenUrl: '',
    });
    this.modalMode.set('create');
  }

  openEditModal(robot: Robot): void {
    this.formError.set(null);
    this.selectedRobot.set(robot);
    this.form.reset({
      nombre: robot.nombre,
      equipo: this.equipoId(robot),
      categoria: this.categoriaId(robot),
      pesoKg: robot.pesoKg,
      sinPeso: robot.pesoKg === null,
      estado: robot.estado,
      imagenUrl: robot.imagenUrl ?? '',
    });
    this.modalMode.set('edit');
  }

  openViewModal(robot: Robot): void {
    this.selectedRobot.set(robot);
    this.modalMode.set('view');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedRobot.set(null);
    this.formError.set(null);
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      nombre: raw.nombre.trim(),
      equipo: raw.equipo,
      categoria: raw.categoria,
      pesoKg: raw.sinPeso ? null : raw.pesoKg,
      estado: raw.estado,
      imagenUrl: raw.imagenUrl || '',
    };

    this.saving.set(true);
    this.formError.set(null);

    const current = this.selectedRobot();
    const request =
      this.modalMode() === 'edit' && current
        ? this.robotService.update(current._id, payload)
        : this.robotService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadRobots();
        this.equipoService.findAll().subscribe({ next: (data) => this.equipos.set(data) });
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.message ?? 'Ocurrió un error al guardar el robot',
        );
      },
    });
  }

  askDelete(robot: Robot): void {
    this.robotToDelete.set(robot);
  }

  cancelDelete(): void {
    this.robotToDelete.set(null);
  }

  confirmDelete(): void {
    const robot = this.robotToDelete();
    if (!robot) return;

    this.deleting.set(true);
    this.robotService.remove(robot._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.robotToDelete.set(null);
        this.loadRobots();
        this.equipoService.findAll().subscribe({ next: (data) => this.equipos.set(data) });
      },
      error: () => {
        this.deleting.set(false);
        this.robotToDelete.set(null);
        this.errorMessage.set('No se pudo eliminar el robot');
      },
    });
  }

  equipoNombre(robot: Robot): string {
    const equipo = robot.equipo;
    return typeof equipo === 'string' ? equipo : equipo?.nombre ?? '—';
  }

  categoriaNombre(robot: Robot): string {
    const categoria = robot.categoria;
    return typeof categoria === 'string' ? categoria : categoria?.nombre ?? '—';
  }

  pesoLabel(peso: number | null): string {
    return peso === null ? '–' : `${peso.toFixed(2)} kg`;
  }

  onImagenChange(value: string): void {
    this.form.controls.imagenUrl.setValue(value);
  }

  estadoBadgeClass(estado: EstadoRobot): string {
    switch (estado) {
      case EstadoRobot.ACTIVO:
        return 'badge--success';
      case EstadoRobot.MANTENIMIENTO:
        return 'badge--info';
      case EstadoRobot.INACTIVO:
        return 'badge--warning';
      default:
        return 'badge--neutral';
    }
  }

  private equipoId(robot: Robot): string {
    const equipo = robot.equipo;
    return typeof equipo === 'string' ? equipo : equipo?._id ?? '';
  }

  private categoriaId(robot: Robot): string {
    const categoria = robot.categoria;
    return typeof categoria === 'string' ? categoria : categoria?._id ?? '';
  }
}
