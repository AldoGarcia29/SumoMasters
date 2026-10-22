import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser, Role } from '../../core/models/auth.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TopbarComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent implements OnInit {
  private readonly userManagementService = inject(UserManagementService);
  private readonly authService = inject(AuthService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly roles = Object.values(Role);
  readonly usuarios = signal<AuthUser[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly rolesModalUser = signal<AuthUser | null>(null);
  readonly rolSeleccionado = signal<Role | null>(null);
  readonly savingRoles = signal(false);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

  readonly usuariosFiltrados = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.usuarios();
    return this.usuarios().filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.userManagementService.findAll().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar los usuarios.');
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  toggleActivo(usuario: AuthUser): void {
    const request = usuario.active
      ? this.userManagementService.deactivate(usuario.id)
      : this.userManagementService.activate(usuario.id);

    request.subscribe({
      next: (actualizado) => this.replaceUsuario(actualizado),
      error: () => this.errorMessage.set('No se pudo actualizar el estado del usuario.'),
    });
  }

  openRolesModal(usuario: AuthUser): void {
    this.rolesModalUser.set(usuario);
    this.rolSeleccionado.set(usuario.roles[0] ?? null);
  }

  closeRolesModal(): void {
    this.rolesModalUser.set(null);
  }

  seleccionarRol(role: Role): void {
    this.rolSeleccionado.set(role);
  }

  guardarRoles(): void {
    const usuario = this.rolesModalUser();
    const role = this.rolSeleccionado();
    if (!usuario || !role) return;

    this.savingRoles.set(true);
    this.userManagementService.updateRole(usuario.id, role).subscribe({
      next: (actualizado) => {
        this.savingRoles.set(false);
        this.replaceUsuario(actualizado);
        this.closeRolesModal();
        if (actualizado.id === this.currentUserId()) {
          this.authService.logout();
        }
      },
      error: () => {
        this.savingRoles.set(false);
        this.errorMessage.set('No se pudieron actualizar los roles.');
      },
    });
  }

  private replaceUsuario(actualizado: AuthUser): void {
    this.usuarios.update((lista) =>
      lista.map((u) => (u.id === actualizado.id ? actualizado : u)),
    );
  }

  roleBadgeClass(role: Role): string {
    switch (role) {
      case Role.ADMIN:
        return 'badge--danger';
      case Role.STAFF:
        return 'badge--info';
      default:
        return 'badge--neutral';
    }
  }
}
