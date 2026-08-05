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
    { icon: 'home', label: 'Dashboard', route: '/dashboard' },
    { icon: 'trophy', label: 'Torneos', route: '/torneos' },
    { icon: 'users', label: 'Equipos', route: '/equipos' },
    { icon: 'robot', label: 'Robots', route: '/robots' },
    { icon: 'grid', label: 'Categorías', route: '/categorias' },
    { icon: 'swords', label: 'Combates', route: '/combates' },
    { icon: 'file', label: 'Reportes', route: '/reportes' },
    { icon: 'user', label: 'Usuarios', route: '/usuarios' },
    { icon: 'settings', label: 'Configuración', route: '/configuracion' },
  ];

  readonly currentUser = this.authService.currentUser;

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
