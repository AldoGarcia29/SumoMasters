import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/auth.model';

interface NavItem {
  icon: string;
  label: string;
  route?: string;
  hasChevron?: boolean;
  /** Si se define, el ítem solo se muestra a usuarios con alguno de estos roles. */
  roles?: Role[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  /** Controla la visibilidad en mobile/tablet (drawer deslizable). En desktop siempre es visible. */
  @Input() isOpen = false;
  @Output() closeRequested = new EventEmitter<void>();

  /** Los módulos sin `route` todavía no están implementados: se muestran deshabilitados. */
 readonly navItems: NavItem[] = [
  {
    icon: 'home',
    label: 'Dashboard',
    route: '/dashboard',
    roles: [Role.ADMIN],
  },
  {
    icon: 'trophy',
    label: 'Torneos',
    route: '/torneos',
    roles: [Role.ADMIN],
  },
  {
    icon: 'users',
    label: 'Equipos',
    route: '/equipos',
    roles: [Role.ADMIN],
  },
  {
    icon: 'robot',
    label: 'Robots',
    route: '/robots',
    roles: [Role.ADMIN],
  },
  {
    icon: 'grid',
    label: 'Categorías',
    route: '/categorias',
    roles: [Role.ADMIN],
  },
  {
    icon: 'swords',
    label: 'Combates',
    route: '/combates',
    roles: [Role.ADMIN],
  },
  {
    icon: 'trophy',
    label: 'Registrar resultados',
    route: '/staff/resultados',
    roles: [Role.STAFF],
  },
  {
    icon: 'building',
    label: 'Dojos',
    route: '/dojos',
    roles: [Role.ADMIN],
  },
  {
    icon: 'file',
    label: 'Reportes',
    route: '/reportes',
    roles: [Role.ADMIN],
  },
  {
    icon: 'user',
    label: 'Usuarios',
    route: '/usuarios',
    roles: [Role.ADMIN],
  },
  {
    icon: 'settings',
    label: 'Configuración',
    route: '/configuracion',
    roles: [Role.ADMIN],
  },
];

  readonly currentUser = this.authService.currentUser;

  /** Solo los ítems del menú a los que el usuario tiene acceso. */
  readonly visibleNavItems = computed(() => {
    this.currentUser(); // dependencia reactiva: se recalcula si cambia la sesión
    return this.navItems.filter(
      (item) => !item.roles || this.authService.hasAnyRole(item.roles),
    );
  });

  readonly displayName = computed(
    () => this.currentUser()?.name ?? this.currentUser()?.username ?? 'Invitado',
  );

  readonly primaryRole = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    if (roles.includes(Role.ADMIN)) return 'Administrador';
    if (roles.includes(Role.STAFF)) return 'Staff';
    return 'Usuario';
  });

  readonly initials = computed(() => {
    const source = this.displayName().trim();
    if (!source) {
      return '?';
    }

    const parts = source.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + second).toUpperCase();
  });

  close(): void {
    this.closeRequested.emit();
  }

  readonly isProfileMenuOpen = signal(false);

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((value) => !value);
  }

  logout(): void {
    this.isProfileMenuOpen.set(false);
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isProfileMenuOpen.set(false);
    }
  }
}
