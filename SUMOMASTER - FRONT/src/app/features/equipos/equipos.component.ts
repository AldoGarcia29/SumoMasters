import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { ImageUploadComponent } from '../../shared/components/image-upload/image-upload.component';
import { EquipoService } from '../../core/services/equipo.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { Equipo } from '../../core/models/equipo.model';
import { Categoria } from '../../core/models/categoria.model';

type ModalMode = 'create' | 'edit' | 'view' | null;

const PAGE_SIZE = 5;

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, TopbarComponent, ImageUploadComponent],
  templateUrl: './equipos.component.html',
  styleUrl: './equipos.component.scss',
})
export class EquiposComponent implements OnInit {
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

  readonly equipos = signal<Equipo[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly page = signal(1);

  readonly filteredEquipos = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.equipos();

    return this.equipos().filter(
      (equipo) =>
        equipo.nombre.toLowerCase().includes(term) ||
        equipo.institucion.toLowerCase().includes(term),
    );
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEquipos().length / PAGE_SIZE)),
  );

  readonly pagedEquipos = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredEquipos().slice(start, start + PAGE_SIZE);
  });

  // ---- Modal / formulario ----
  readonly modalMode = signal<ModalMode>(null);
  readonly selectedEquipo = signal<Equipo | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly equipoToDelete = signal<Equipo | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    institucion: ['', [Validators.required, Validators.maxLength(120)]],
    categoria: ['', Validators.required],
    logoUrl: this.fb.nonNullable.control<string>(''),
    integrantes: this.fb.array<ReturnType<typeof this.buildIntegranteControl>>(
      [],
    ),
  });

  get integrantesArray(): FormArray {
    return this.form.controls.integrantes;
  }

  private buildIntegranteControl(nombre = '', rol = '') {
    return this.fb.nonNullable.group({
      nombre: [nombre, Validators.required],
      rol: [rol],
    });
  }

  addIntegrante(): void {
    this.integrantesArray.push(this.buildIntegranteControl());
  }

  removeIntegrante(index: number): void {
    if (this.integrantesArray.length > 1) {
      this.integrantesArray.removeAt(index);
    }
  }

  ngOnInit(): void {
    this.loadCategorias();
    this.loadEquipos();
  }

  loadCategorias(): void {
    this.categoriaService.findAll().subscribe({
      next: (data) => this.categorias.set(data),
    });
  }

  loadEquipos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.equipoService.findAll().subscribe({
      next: (data) => {
        this.equipos.set(data);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudieron cargar los equipos. Verifica que el servicio esté disponible.',
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
    this.selectedEquipo.set(null);
    this.form.reset({ nombre: '', institucion: '', categoria: '', logoUrl: '' });
    this.integrantesArray.clear();
    this.addIntegrante();
    this.modalMode.set('create');
  }

  openEditModal(equipo: Equipo): void {
    this.formError.set(null);
    this.selectedEquipo.set(equipo);
    this.form.reset({
      nombre: equipo.nombre,
      institucion: equipo.institucion,
      categoria: this.categoriaId(equipo),
      logoUrl: equipo.logoUrl ?? '',
    });
    this.integrantesArray.clear();
    equipo.integrantes.forEach((i) =>
      this.integrantesArray.push(this.buildIntegranteControl(i.nombre, i.rol)),
    );
    if (this.integrantesArray.length === 0) this.addIntegrante();
    this.modalMode.set('edit');
  }

  openViewModal(equipo: Equipo): void {
    this.selectedEquipo.set(equipo);
    this.modalMode.set('view');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedEquipo.set(null);
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
      institucion: raw.institucion.trim(),
      categoria: raw.categoria,
      logoUrl: raw.logoUrl || '',
      integrantes: raw.integrantes
        .filter((i) => i.nombre.trim())
        .map((i) => ({ nombre: i.nombre.trim(), rol: i.rol?.trim() || '' })),
    };

    this.saving.set(true);
    this.formError.set(null);

    const current = this.selectedEquipo();
    const request =
      this.modalMode() === 'edit' && current
        ? this.equipoService.update(current._id, payload)
        : this.equipoService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadEquipos();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.message ?? 'Ocurrió un error al guardar el equipo',
        );
      },
    });
  }

  askDelete(equipo: Equipo): void {
    this.equipoToDelete.set(equipo);
  }

  cancelDelete(): void {
    this.equipoToDelete.set(null);
  }

  confirmDelete(): void {
    const equipo = this.equipoToDelete();
    if (!equipo) return;

    this.deleting.set(true);
    this.equipoService.remove(equipo._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.equipoToDelete.set(null);
        this.loadEquipos();
      },
      error: () => {
        this.deleting.set(false);
        this.equipoToDelete.set(null);
        this.errorMessage.set('No se pudo eliminar el equipo');
      },
    });
  }

  onLogoChange(value: string): void {
    this.form.controls.logoUrl.setValue(value);
  }

  categoriaNombre(equipo: Equipo): string {
    const categoria = equipo.categoria;
    return typeof categoria === 'string' ? categoria : categoria?.nombre ?? '—';
  }

  private categoriaId(equipo: Equipo): string {
    const categoria = equipo.categoria;
    return typeof categoria === 'string' ? categoria : categoria?._id ?? '';
  }
}
