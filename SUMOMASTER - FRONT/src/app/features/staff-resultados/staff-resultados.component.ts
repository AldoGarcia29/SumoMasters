import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AsignacionesStaffService, AsignacionStaff } from '../../core/services/asignaciones-staff.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/auth.model';
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
          <p *ngIf="esStaff()">Selecciona tu dojo asignado para registrar resultados. Si tienes una sola asignación para hoy, se abrirá automáticamente.</p>
          <p *ngIf="!esStaff()">Selecciona un torneo para registrar los resultados de sus combates.</p>
          <p *ngIf="loading()">Cargando torneos...</p>
          <p *ngIf="error()" role="alert">{{ error() }}</p>
          <p *ngIf="!loading() && !error() && esStaff() && !asignacionesVigentes().length && !asignaciones().length">No hay asignaciones vinculadas a tu cuenta. Pide al administrador que compruebe el usuario y el torneo.</p>
          <p *ngIf="!loading() && !error() && esStaff() && !asignacionesVigentes().length && asignaciones().length">Tienes asignaciones registradas, pero ninguna corresponde a hoy. Consulta las fechas a continuación.</p>
          <div class="staff-list" *ngIf="esStaff() && !asignacionesVigentes().length">
            <div *ngFor="let a of asignaciones()" class="staff-torneo">
              <span><strong>{{ nombreTorneo(a.torneo) }} · {{ nombreDojo(a.dojo) }}</strong><small>Asignado para {{ a.fecha }}</small></span>
              <span>Otra fecha</span>
            </div>
          </div>
          <p *ngIf="!loading() && !error() && !esStaff() && !torneos().length">No hay torneos disponibles.</p>
          <div class="staff-list" *ngIf="esStaff()">
            <a *ngFor="let a of asignacionesVigentes()" class="staff-torneo"
               [routerLink]="['/torneos', a.torneo, 'resultados']" [queryParams]="{dojo: a.dojo}">
              <span><strong>{{ nombreTorneo(a.torneo) }} · {{ nombreDojo(a.dojo) }}</strong><small>Fecha: {{ a.fecha }}</small></span>
              <span>Ver mis combates →</span>
            </a>
          </div>
          <div class="staff-list" *ngIf="!esStaff()">
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
    :host { display:block; min-height:100dvh; background:#f5f3fb; }
    :host, .staff-content { position:relative; }
    .staff-content { margin-left:260px; min-height:100dvh; display:flex; flex-direction:column; justify-content:flex-start; }
    .staff-content app-topbar { display:block; flex:none; }
    .staff-main { width:100%; box-sizing:border-box; padding:24px 32px; max-width:1100px; margin:0 auto; flex:1 0 auto; }
    .staff-panel { background:white; border:1px solid #ded7f5; border-radius:20px; padding:30px; }
    h1 { color:#201636; margin:0 0 10px; } p { color:#696477; }
    .staff-list { display:grid; gap:12px; margin-top:25px; }
    .staff-torneo { display:flex; align-items:center; justify-content:space-between; gap:15px; padding:20px; border:1px solid #e1daf7; border-radius:12px; color:#5c2cce; text-decoration:none; }
    .staff-torneo:hover { background:#f6f1ff; }
    .staff-torneo strong { display:block; color:#24183e; }
    .staff-torneo small { display:block; color:#756e82; margin-top:5px; }
    .staff-torneo span { min-width:0; overflow-wrap:anywhere; }
    @media(max-width:900px) { .staff-content { margin-left:0; } .staff-main { padding:16px; } .staff-panel { padding:20px; } }
    @media(max-width:600px) {
      .staff-main { padding:12px; } .staff-panel { padding:18px 14px; border-radius:14px; }
      .staff-panel h1 { font-size:1.35rem; }
      .staff-torneo { flex-direction:column; align-items:stretch; gap:10px; padding:15px; }
      .staff-torneo span:last-child { font-weight:600; }
    }
  `],
})
export class StaffResultadosComponent implements OnInit {
  private readonly torneosService = inject(TorneoService);
  private readonly asignacionesService = inject(AsignacionesStaffService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly esStaff = () => this.auth.hasAnyRole([Role.STAFF]) && !this.auth.hasAnyRole([Role.ADMIN]);
  readonly asignaciones = signal<AsignacionStaff[]>([]);
  readonly dojos = signal<{_id: string; nombre: string}[]>([]);
  readonly asignacionesVigentes = () => {
    const hoy = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
    return this.asignaciones().filter(a => a.fecha === hoy);
  };
  nombreTorneo(id: string): string { return this.torneos().find(t => t._id === id)?.nombre ?? 'Torneo'; }
  nombreDojo(id: string): string { return this.dojos().find(d => d._id === id)?.nombre ?? 'Dojo asignado'; }
  readonly sidebarOpen = signal(false);
  readonly torneos = signal<Torneo[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void {
    if (!this.esStaff()) {
      this.torneosService.findAll().subscribe({
        next: torneos => { this.torneos.set(torneos); this.loading.set(false); },
        error: () => { this.error.set('No se pudieron cargar los torneos.'); this.loading.set(false); },
      });
      return;
    }
    forkJoin({
      asignaciones: this.asignacionesService.mias(),
      torneos: this.torneosService.findAll(),
    }).subscribe({
      next: ({asignaciones, torneos}) => {
        this.asignaciones.set(asignaciones);
        this.torneos.set(torneos);
        this.loading.set(false);
        const vigentes = this.asignacionesVigentes();
        if (vigentes.length === 1) {
          const a = vigentes[0];
          this.router.navigate(['/torneos', a.torneo, 'resultados'], {queryParams: {dojo: a.dojo}});
        }
      },
      error: () => { this.error.set('No se pudieron cargar tus asignaciones de dojo.'); this.loading.set(false); },
    });
  }
}
