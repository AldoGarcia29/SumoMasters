import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { AuthService } from '../../core/services/auth.service';
import { EventoConfigService } from '../../core/services/evento-config.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';

interface Preferencias {
  notificacionesCombates: boolean;
  notificacionesTorneos: boolean;
  densidadCompacta: boolean;
}

const STORAGE_KEY = 'sumomasters:preferencias';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, TopbarComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.scss',
})
export class ConfiguracionComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly eventoConfigService = inject(EventoConfigService);

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
  readonly eventoLoading = signal(true);
  readonly eventoSaving = signal(false);
  readonly eventoError = signal<string | null>(null);
  readonly eventoSaved = signal(false);
  readonly eventoForm = { nombreEvento: '', lema: '' };

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

  ngOnInit(): void {
    this.eventoConfigService.obtener().subscribe({
      next: (config) => {
        this.eventoForm.nombreEvento = config.nombreEvento;
        this.eventoForm.lema = config.lema;
        this.eventoLoading.set(false);
      },
      error: (err) => {
        this.eventoError.set(
          extractErrorMessage(err, 'No se pudo cargar la configuración del evento.'),
        );
        this.eventoLoading.set(false);
      },
    });
  }

  guardarEvento(): void {
    const nombreEvento = this.eventoForm.nombreEvento.trim();
    if (!nombreEvento || this.eventoSaving()) return;

    this.eventoSaving.set(true);
    this.eventoError.set(null);
    this.eventoSaved.set(false);
    this.eventoConfigService
      .actualizar({
        nombreEvento,
        lema: this.eventoForm.lema.trim(),
      })
      .subscribe({
        next: (config) => {
          this.eventoForm.nombreEvento = config.nombreEvento;
          this.eventoForm.lema = config.lema;
          this.eventoSaving.set(false);
          this.eventoSaved.set(true);
        },
        error: (err) => {
          this.eventoSaving.set(false);
          this.eventoError.set(
            extractErrorMessage(err, 'No se pudo guardar la configuración del evento.'),
          );
        },
      });
  }

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
