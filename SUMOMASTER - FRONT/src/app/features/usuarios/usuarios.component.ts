import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser, Role } from '../../core/models/auth.model';
import { AsignacionesStaffService, AsignacionStaff } from '../../core/services/asignaciones-staff.service';
import { TorneoService } from '../../core/services/torneo.service';
import { DojoService } from '../../core/services/dojo.service';
import { Torneo } from '../../core/models/torneo.model';
import { Dojo } from '../../core/models/dojo.model';

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
  private readonly asignacionesService = inject(AsignacionesStaffService);
  private readonly torneoService = inject(TorneoService);
  private readonly dojoService = inject(DojoService);
  readonly torneos = signal<Torneo[]>([]);
  readonly dojos = signal<Dojo[]>([]);
  readonly asignaciones = signal<AsignacionStaff[]>([]);
  readonly asignacionUsuario = signal<AuthUser | null>(null);
  readonly torneoElegido = signal('');
  readonly dojoElegido = signal('');
  readonly fechaElegida = signal('');
  readonly guardandoAsignacion = signal(false);
  readonly asignacionError = signal('');
  abrirAsignaciones(u: AuthUser): void {
    this.asignacionUsuario.set(u);
    this.asignacionError.set('');
    this.refrescarAsignaciones();
  }
  cerrarAsignaciones(): void { this.asignacionUsuario.set(null); }
  refrescarAsignaciones(): void {
    this.asignacionesService.todas().subscribe({
      next: data => this.asignaciones.set(data),
      error: () => this.asignacionError.set('No se pudieron consultar las asignaciones'),
    });
  }
  asignacionesDeUsuario(id: string): AsignacionStaff[] {
    return this.asignaciones().filter(a => a.usuario === id);
  }
  nombreTorneo(id: string): string { return this.torneos().find(t => t._id === id)?.nombre ?? id; }
  nombreDojo(id: string): string { return this.dojos().find(d => d._id === id)?.nombre ?? id; }
  guardarAsignacion(): void {
    const u = this.asignacionUsuario();
    if (!u || !this.torneoElegido() || !this.dojoElegido() || !this.fechaElegida()) {
      this.asignacionError.set('Selecciona torneo, dojo y fecha'); return;
    }
    this.guardandoAsignacion.set(true);
    this.asignacionesService.crear(u.id, this.torneoElegido(), this.dojoElegido(), this.fechaElegida()).subscribe({
      next: () => { this.guardandoAsignacion.set(false); this.asignacionError.set(''); this.refrescarAsignaciones(); },
      error: (e) => { this.guardandoAsignacion.set(false); this.asignacionError.set(e.error?.message ?? 'No se pudo asignar el dojo'); },
    });
  }
  eliminarAsignacion(id: string): void {
    this.asignacionesService.eliminar(id).subscribe({
      next: () => this.refrescarAsignaciones(),
      error: () => this.asignacionError.set('No se pudo eliminar la asignación'),
    });
  }

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly Role = Role;
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
    this.torneoService.findAll().subscribe({ next: data => this.torneos.set(data) });
    this.dojoService.findAll().subscribe({ next: data => this.dojos.set(data) });
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
