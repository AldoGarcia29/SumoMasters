import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Role } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

/**
 * Menú de usuario para las páginas públicas de /live.
 * Solo se muestra si hay una sesión iniciada; permite cerrar sesión desde aquí.
 */
@Component({
  selector: 'app-live-user-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './live-user-menu.component.html',
  styleUrls: ['./live-user-menu.component.css'],
})
export class LiveUserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly user = this.auth.currentUser;
  readonly abierto = signal(false);

  readonly nombre = computed(
    () => this.user()?.name ?? this.user()?.username ?? '',
  );

  readonly email = computed(() => this.user()?.email ?? '');

  readonly iniciales = computed(() => {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    const primera = partes[0][0] ?? '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + ultima).toUpperCase();
  });

  /** ADMIN o STAFF pueden volver al panel; un usuario sin permisos solo puede cerrar sesión. */
  readonly tienePanel = computed(() => {
    const roles = this.user()?.roles ?? [];
    return roles.includes(Role.ADMIN) || roles.includes(Role.STAFF);
  });

  readonly rutaPanel = computed(() => {
    this.user(); // se recalcula si cambia la sesión
    return this.auth.homeRoute();
  });

  alternar(): void {
    this.abierto.update((v) => !v);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  salir(): void {
    this.abierto.set(false);
    this.auth.logout();
  }

  /** Cierra el menú si el clic fue fuera del componente. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.abierto.set(false);
    }
  }
}
