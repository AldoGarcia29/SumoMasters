import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { AuthService } from '../../core/services/auth.service';

interface Preferencias {
  notificacionesCombates: boolean;
  notificacionesTorneos: boolean;
  densidadCompacta: boolean;
}

const STORAGE_KEY = 'sumomasters:preferencias';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TopbarComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss',
})
export class ConfiguracionComponent {
  private readonly authService = inject(AuthService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly currentUser = this.authService.currentUser;

  readonly preferencias = signal<Preferencias>(this.loadPreferencias());
  readonly saved = signal(false);

  readonly puntuacion = {
    victoria: 3,
    empate: 1,
    derrota: 0,
  };

  readonly criteriosDesempate = [
    'Puntos',
    'Diferencia (victorias − derrotas)',
    'Victorias',
  ];

  toggle(campo: keyof Preferencias): void {
    this.preferencias.update((prev) => ({ ...prev, [campo]: !prev[campo] }));
    this.guardar();
  }

  private guardar(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferencias()));
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 1500);
  }

  private loadPreferencias(): Preferencias {
    const defaults: Preferencias = {
      notificacionesCombates: true,
      notificacionesTorneos: true,
      densidadCompacta: false,
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
