import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { CategoriaService } from '../../core/services/categoria.service';
import {
  Categoria,
  EstadoCategoria,
  TipoCombate,
} from '../../core/models/categoria.model';

type ModalMode = 'create' | 'edit' | 'view' | null;

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, TopbarComponent],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.scss',
})
export class CategoriasComponent implements OnInit {
  private readonly categoriaService = inject(CategoriaService);
  private readonly fb = inject(FormBuilder);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly tiposCombate = Object.values(TipoCombate);
  readonly estados = Object.values(EstadoCategoria);

  readonly categorias = signal<Categoria[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly estadoFiltro = signal<string>('');

  readonly filteredCategorias = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const estado = this.estadoFiltro();

    return this.categorias().filter((categoria) => {
      const matchesTerm =
        !term ||
        categoria.nombre.toLowerCase().includes(term) ||
        categoria.descripcion.toLowerCase().includes(term);
      const matchesEstado = !estado || categoria.estado === estado;
      return matchesTerm && matchesEstado;
    });
  });

  // ---- Modal / formulario ----
  readonly modalMode = signal<ModalMode>(null);
  readonly selectedCategoria = signal<Categoria | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly categoriaToDelete = signal<Categoria | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', [Validators.required, Validators.maxLength(300)]],
    tipoCombate: [TipoCombate.SUMO, Validators.required],
    pesoMaximoKg: this.fb.control<number | null>(null),
    sinLimite: [false],
    estado: [EstadoCategoria.EN_PREPARACION, Validators.required],
  });

  ngOnInit(): void {
    this.loadCategorias();
  }

  loadCategorias(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.categoriaService.findAll().subscribe({
      next: (data) => {
        this.categorias.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudieron cargar las categorías. Verifica que el servicio esté disponible.',
        );
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onEstadoFiltroChange(value: string): void {
    this.estadoFiltro.set(value);
  }

  // ---- Abrir modales ----
  openCreateModal(): void {
    this.formError.set(null);
    this.form.reset({
      nombre: '',
      descripcion: '',
      tipoCombate: TipoCombate.SUMO,
      pesoMaximoKg: null,
      sinLimite: false,
      estado: EstadoCategoria.EN_PREPARACION,
    });
    this.selectedCategoria.set(null);
    this.modalMode.set('create');
  }

  openEditModal(categoria: Categoria): void {
    this.formError.set(null);
    this.selectedCategoria.set(categoria);
    this.form.reset({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      tipoCombate: categoria.tipoCombate,
      pesoMaximoKg: categoria.pesoMaximoKg,
      sinLimite: categoria.pesoMaximoKg === null,
      estado: categoria.estado,
    });
    this.modalMode.set('edit');
  }

  openViewModal(categoria: Categoria): void {
    this.selectedCategoria.set(categoria);
    this.modalMode.set('view');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedCategoria.set(null);
    this.formError.set(null);
  }

  // ---- Guardar (crear / editar) ----
  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = {
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion.trim(),
      tipoCombate: raw.tipoCombate,
      pesoMaximoKg: raw.sinLimite ? null : raw.pesoMaximoKg,
      estado: raw.estado,
    };

    this.saving.set(true);
    this.formError.set(null);

    const current = this.selectedCategoria();
    const request =
      this.modalMode() === 'edit' && current
        ? this.categoriaService.update(current._id, payload)
        : this.categoriaService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadCategorias();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(
          err?.error?.message ?? 'Ocurrió un error al guardar la categoría',
        );
      },
    });
  }

  // ---- Eliminar ----
  askDelete(categoria: Categoria): void {
    this.categoriaToDelete.set(categoria);
  }

  cancelDelete(): void {
    this.categoriaToDelete.set(null);
  }

  confirmDelete(): void {
    const categoria = this.categoriaToDelete();
    if (!categoria) return;

    this.deleting.set(true);
    this.categoriaService.remove(categoria._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.categoriaToDelete.set(null);
        this.loadCategorias();
      },
      error: () => {
        this.deleting.set(false);
        this.categoriaToDelete.set(null);
        this.errorMessage.set('No se pudo eliminar la categoría');
      },
    });
  }

  estadoBadgeClass(estado: EstadoCategoria): string {
    switch (estado) {
      case EstadoCategoria.ACTIVA:
        return 'badge--success';
      case EstadoCategoria.EN_PREPARACION:
        return 'badge--warning';
      default:
        return 'badge--neutral';
    }
  }

  pesoLabel(peso: number | null): string {
    return peso === null ? 'Sin límite' : `${peso.toFixed(2)} kg`;
  }
}
