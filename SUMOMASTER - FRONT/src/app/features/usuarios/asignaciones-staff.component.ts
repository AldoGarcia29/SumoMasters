import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TorneoService } from '../../core/services/torneo.service';
import { DojoService } from '../../core/services/dojo.service';
import { CombateService, AsignacionStaff, StaffJuez } from '../../core/services/combate.service';
import { Torneo } from '../../core/models/torneo.model';
import { Dojo } from '../../core/models/dojo.model';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

@Component({
  selector: 'app-asignaciones-staff', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarComponent, TopbarComponent],
  template: `
    <app-sidebar [isOpen]="sidebarOpen()" (closeRequested)="sidebarOpen.set(false)" />
    <div class="contenido">
      <app-topbar title="Asignación de jueces" (menuToggle)="sidebarOpen.set(!sidebarOpen())" />
      <main>
        <section class="panel">
          <h1>Asignar STAFF a dojos</h1>
          <p>Selecciona un torneo, fecha y dojo (1–5). Puedes asignar dos o más jueces al mismo dojo.</p>
          <div class="campos">
            <label>Torneo <select [(ngModel)]="torneoId" (ngModelChange)="cargarAsignaciones()"><option value="">Selecciona un torneo</option><option *ngFor="let t of torneos()" [value]="t._id">{{t.nombre}}</option></select></label>
            <label>Fecha de jornada <input type="date" [(ngModel)]="fecha" /></label>
            <label>Juez (STAFF) <select [(ngModel)]="staffId"><option value="">Selecciona un juez</option><option *ngFor="let u of staff()" [value]="u._id">{{u.name}} — {{u.email}}</option></select></label>
            <label>Dojo <select [(ngModel)]="dojoId"><option value="">Selecciona un dojo</option><option *ngFor="let d of dojos()" [value]="d._id">{{d.nombre}}</option></select></label>
          </div>
          <button type="button" [disabled]="guardando() || !torneoId || !fecha || !staffId || !dojoId" (click)="asignar()">{{guardando() ? 'Guardando...' : 'Asignar juez'}}</button>
          <p class="error" role="alert" *ngIf="error()">{{error()}}</p>
          <p class="exito" *ngIf="mensaje()">{{mensaje()}}</p>
        </section>
        <section class="panel" *ngIf="torneoId">
          <h2>Asignaciones del torneo</h2>
          <p *ngIf="!asignaciones().length">No hay asignaciones registradas.</p>
          <div class="tabla"><table *ngIf="asignaciones().length"><thead><tr><th>Fecha</th><th>Juez</th><th>Dojo</th><th>Acción</th></tr></thead>
            <tbody><tr *ngFor="let a of asignaciones()"><td>{{a.fecha}}</td><td>{{nombreStaff(a.staffId)}}</td><td>{{nombreDojo(a.dojoId)}}</td><td><button type="button" class="quitar" (click)="quitar(a)">Quitar</button></td></tr></tbody></table></div>
        </section>
      </main>
    </div>`,
  styles: [`
    :host { display:block; background:#f5f3fb; min-height:100dvh; }
    .contenido { margin-left:260px; min-height:100dvh; }
    main { padding:24px; max-width:1050px; margin:auto; }
    .panel { background:white; padding:24px; border:1px solid #e1dafa; border-radius:16px; margin-bottom:20px; }
    h1,h2 { color:#201636; } p { color:#635d70; }
    .campos { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin:20px 0; }
    label { display:flex; flex-direction:column; gap:6px; font-weight:600; }
    select,input { width:100%; box-sizing:border-box; padding:12px; border:1px solid #cfc5e8; border-radius:9px; background:#f8f6ff; font:inherit; }
    button { border:0; border-radius:9px; padding:12px 18px; background:#6d28d9; color:white; font-weight:600; cursor:pointer; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    button.quitar { background:#a32b39; }
    .error { color:#b91c1c; } .exito { color:#166534; }
    .tabla { overflow-x:auto; } table { border-collapse:collapse; width:100%; } th,td { text-align:left; padding:12px; border-bottom:1px solid #eee; }
    @media(max-width:900px) { .contenido { margin-left:0; } main { padding:12px; } }
    @media(max-width:600px) { .campos { grid-template-columns:1fr; } .panel { padding:16px; } }
  `],
})
export class AsignacionesStaffComponent implements OnInit {
  private readonly torneosSvc = inject(TorneoService);
  private readonly dojoSvc = inject(DojoService);
  private readonly combatesSvc = inject(CombateService);
  readonly sidebarOpen = signal(false);
  readonly torneos = signal<Torneo[]>([]);
  readonly dojos = signal<Dojo[]>([]);
  readonly staff = signal<StaffJuez[]>([]);
  readonly asignaciones = signal<AsignacionStaff[]>([]);
  readonly error = signal(''); readonly mensaje = signal(''); readonly guardando = signal(false);
  torneoId = ''; staffId = ''; dojoId = ''; fecha = '';
  ngOnInit(): void {
    forkJoin({torneos:this.torneosSvc.findAll(), dojos:this.dojoSvc.findAll(), staff:this.combatesSvc.listarStaff()}).subscribe({
      next: data => {this.torneos.set(data.torneos);this.dojos.set(data.dojos);this.staff.set(data.staff);},
      error: () => this.error.set('No se pudieron cargar los datos. Comprueba el backend.'),
    });
  }
  cargarAsignaciones(): void {
    this.asignaciones.set([]);
    if (!this.torneoId) return;
    this.combatesSvc.listarAsignaciones(this.torneoId).subscribe({
      next: items => this.asignaciones.set(items),
      error: () => this.error.set('No se pudieron cargar las asignaciones.'),
    });
  }
  asignar(): void {
    this.error.set('');this.mensaje.set('');this.guardando.set(true);
    this.combatesSvc.asignarStaff(this.torneoId,{staffId:this.staffId,dojoId:this.dojoId,fecha:this.fecha}).subscribe({
      next: () => {this.guardando.set(false);this.mensaje.set('Asignación guardada.');this.cargarAsignaciones();},
      error: () => {this.guardando.set(false);this.error.set('No se pudo asignar el juez.');},
    });
  }
  quitar(a: AsignacionStaff): void {
    if (!confirm('¿Quitar esta asignación?')) return;
    this.combatesSvc.quitarAsignacion(a._id).subscribe({
      next: () => this.cargarAsignaciones(),
      error: () => this.error.set('No se pudo quitar la asignación.'),
    });
  }
  nombreStaff(id:string):string {return this.staff().find(u=>u._id===id)?.name ?? id;}
  nombreDojo(id:string):string {return this.dojos().find(d=>d._id===id)?.nombre ?? id;}
}
