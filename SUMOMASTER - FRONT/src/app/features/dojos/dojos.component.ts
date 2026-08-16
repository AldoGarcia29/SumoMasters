import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { DojoService } from '../../core/services/dojo.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { Dojo, EstadoDojo } from '../../core/models/dojo.model';

type ModalMode = 'create' | 'edit' | null;

@Component({
  selector: 'app-dojos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SidebarComponent, TopbarComponent],
  templateUrl: './dojos.component.html',
  styleUrl: './dojos.component.scss',
})
export class DojosComponent implements OnInit {
  private readonly dojoService = inject(DojoService);
  private readonly fb = inject(FormBuilder);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly estados = Object.values(EstadoDojo);

  readonly dojos = signal<Dojo[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly dojosFiltrados = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.dojos();
    return this.dojos().filter((d) => d.nombre.toLowerCase().includes(term));
  });

  readonly modalMode = signal<ModalMode>(null);
  readonly selectedDojo = signal<Dojo | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly dojoToDelete = signal<Dojo | null>(null);
  readonly deleting = signal(false);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    estado: [EstadoDojo.DISPONIBLE, Validators.required],
    capacidad: [4, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.dojoService.findAll().subscribe({
      next: (data) => {
        this.dojos.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los dojos.');
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  openCreateModal(): void {
    this.formError.set(null);
    this.selectedDojo.set(null);
    this.form.reset({ nombre: '', estado: EstadoDojo.DISPONIBLE, capacidad: 4 });
    this.modalMode.set('create');
  }

  openEditModal(dojo: Dojo): void {
    this.formError.set(null);
    this.selectedDojo.set(dojo);
    this.form.reset({ nombre: dojo.nombre, estado: dojo.estado, capacidad: dojo.capacidad });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.selectedDojo.set(null);
    this.formError.set(null);
  }

  submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload = { nombre: raw.nombre.trim(), estado: raw.estado, capacidad: raw.capacidad };

    this.saving.set(true);
    this.formError.set(null);

    const current = this.selectedDojo();
    const request =
      this.modalMode() === 'edit' && current
        ? this.dojoService.update(current._id, payload)
        : this.dojoService.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Ocurrió un error al guardar el dojo'));
      },
    });
  }

  askDelete(dojo: Dojo): void {
    this.dojoToDelete.set(dojo);
  }

  cancelDelete(): void {
    this.dojoToDelete.set(null);
  }

  confirmDelete(): void {
    const dojo = this.dojoToDelete();
    if (!dojo) return;

    this.deleting.set(true);
    this.dojoService.remove(dojo._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dojoToDelete.set(null);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.dojoToDelete.set(null);
        this.errorMessage.set('No se pudo eliminar el dojo.');
      },
    });
  }

  estadoBadgeClass(estado: EstadoDojo): string {
    switch (estado) {
      case EstadoDojo.DISPONIBLE:
        return 'badge--success';
      case EstadoDojo.OCUPADO:
        return 'badge--warning';
      default:
        return 'badge--neutral';
    }
  }
}
