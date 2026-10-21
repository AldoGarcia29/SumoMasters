import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TorneoService } from '../../core/services/torneo.service';
import { Torneo } from '../../core/models/torneo.model';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

@Component({
  selector: 'app-staff-resultados',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  template: `
    <app-sidebar [isOpen]="sidebarOpen()" (closeRequested)="sidebarOpen.set(false)" />
    <div class="staff-content">
      <app-topbar title="Registro de resultados" (menuToggle)="sidebarOpen.set(!sidebarOpen())" />
      <main class="staff-main">
        <section class="staff-panel">
          <h1>Registro de resultados</h1>
          <p>Selecciona un torneo para registrar los resultados de sus combates.</p>
          <p *ngIf="loading()">Cargando torneos...</p>
          <p *ngIf="error()" role="alert">{{ error() }}</p>
          <p *ngIf="!loading() && !error() && !torneos().length">No hay torneos disponibles.</p>
          <div class="staff-list">
            <a *ngFor="let torneo of torneos()" class="staff-torneo"
               [routerLink]="['/torneos', torneo._id, 'resultados']">
              <span><strong>{{ torneo.nombre }}</strong><small>{{ torneo.estado }}</small></span>
              <span>Registrar resultados →</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#f5f3fb; }
    .staff-content { margin-left:260px; min-height:100vh; }
    .staff-main { padding:32px; max-width:1100px; margin:auto; }
    .staff-panel { background:white; border:1px solid #ded7f5; border-radius:20px; padding:30px; }
    h1 { color:#201636; margin:0 0 10px; } p { color:#696477; }
    .staff-list { display:grid; gap:12px; margin-top:25px; }
    .staff-torneo { display:flex; align-items:center; justify-content:space-between; gap:15px; padding:20px; border:1px solid #e1daf7; border-radius:12px; color:#5c2cce; text-decoration:none; }
    .staff-torneo:hover { background:#f6f1ff; }
    .staff-torneo strong { display:block; color:#24183e; }
    .staff-torneo small { display:block; color:#756e82; margin-top:5px; }
    @media(max-width:900px) { .staff-content { margin-left:0; } .staff-main { padding:16px; } .staff-panel { padding:20px; } }
  `],
})
export class StaffResultadosComponent implements OnInit {
  private readonly torneosService = inject(TorneoService);
  readonly sidebarOpen = signal(false);
  readonly torneos = signal<Torneo[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void {
    this.torneosService.findAll().subscribe({
      next: (torneos) => { this.torneos.set(torneos); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar los torneos.'); this.loading.set(false); },
    });
  }
}
