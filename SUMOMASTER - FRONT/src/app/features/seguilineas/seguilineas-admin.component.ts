import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthUser, Role } from '../../core/models/auth.model';
import { Robot } from '../../core/models/robot.model';
import {
  RankingSeguilineas,
  TorneoSeguilineas,
  formatearTiempo,
} from '../../core/models/seguilineas.model';
import { EstadoTorneo } from '../../core/models/torneo.model';
import { AuthService } from '../../core/services/auth.service';
import { RobotService } from '../../core/services/robot.service';
import { SeguilineasService } from '../../core/services/seguilineas.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

@Component({
  selector: 'app-seguilineas-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl: './seguilineas-admin.component.html',
  styleUrl: './seguilineas-admin.component.scss',
})
export class SeguilineasAdminComponent implements OnInit {
  private readonly api = inject(SeguilineasService);
  private readonly usuarios = inject(UserManagementService);
  private readonly robotsApi = inject(RobotService);
  readonly esAdmin = inject(AuthService).isAdmin;

  readonly fmt = formatearTiempo;
  readonly estados = Object.values(EstadoTorneo);
  /** "Finalizado" solo se alcanza con el botón Finalizar (POST :id/finalizar). */
  readonly estadosEditables = computed(() =>
    this.seleccionado()?.estado === EstadoTorneo.FINALIZADO
      ? this.estados
      : this.estados.filter((e) => e !== EstadoTorneo.FINALIZADO),
  );
  readonly yaFinalizado = computed(
    () => this.seleccionado()?.estado === EstadoTorneo.FINALIZADO,
  );
  readonly podioActual = computed<
    { nombre: string; mejorTiempoMs: number | null }[]
  >(() => {
    const d = this.detalle();
    return d?.estado === EstadoTorneo.FINALIZADO && d.podio.length
      ? d.podio
      : (d?.top3 ?? []);
  });
  readonly sidebarOpen = signal(false);
  readonly torneos = signal<TorneoSeguilineas[]>([]);
  readonly staff = signal<AuthUser[]>([]);
  readonly robots = signal<Robot[]>([]);
  readonly seleccionado = signal<TorneoSeguilineas | null>(null);
  readonly detalle = signal<RankingSeguilineas | null>(null);
  readonly staffSel = signal<string[]>([]);
  readonly mensaje = signal('');
  readonly error = signal('');

  nuevo = { nombre: '', fecha: '', descripcion: '' };
  edicion = {
    nombre: '',
    fecha: '',
    descripcion: '',
    estado: EstadoTorneo.PROGRAMADO as string,
  };
  robotId = '';

  readonly robotsDisponibles = computed(() => {
    const todos = this.robots();
    const seg = todos.filter(
      (r) =>
        typeof r.categoria !== 'string' &&
        /seguil/i.test(r.categoria?.nombre ?? ''),
    );
    const inscritos = new Set(
      this.detalle()?.ranking.map((f) => f.robotId) ?? [],
    );
    return (seg.length ? seg : todos).filter((r) => !inscritos.has(r._id));
  });

  ngOnInit(): void {
    this.cargar();
    if (this.esAdmin()) {
      this.usuarios.findAll().subscribe({
        next: (u) =>
          this.staff.set(
            u.filter((x) => x.active && x.roles.includes(Role.STAFF)),
          ),
        error: (e) =>
          this.error.set(extractErrorMessage(e, 'No se pudo cargar el staff')),
      });
      this.robotsApi.findAll().subscribe({ next: (r) => this.robots.set(r) });
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  cargar(): void {
    this.api.misTorneos().subscribe({
      next: (t) => {
        this.torneos.set(t);
        const actual = this.seleccionado();
        if (actual)
          this.seleccionar(t.find((x) => x._id === actual._id) ?? null);
      },
      error: (e) =>
        this.error.set(
          extractErrorMessage(e, 'No se pudieron cargar los torneos'),
        ),
    });
  }

  crear(): void {
    this.limpiar();
    this.api
      .crear({
        nombre: this.nuevo.nombre.trim(),
        fecha: this.nuevo.fecha,
        descripcion: this.nuevo.descripcion.trim(),
      })
      .subscribe({
        next: () => {
          this.nuevo = { nombre: '', fecha: '', descripcion: '' };
          this.mensaje.set('Torneo creado.');
          this.cargar();
        },
        error: (e) =>
          this.error.set(extractErrorMessage(e, 'No se pudo crear el torneo')),
      });
  }

  seleccionar(t: TorneoSeguilineas | null): void {
    this.seleccionado.set(t);
    this.detalle.set(null);
    this.staffSel.set(t?.staffAsignados?.map(String) ?? []);
    if (!t) return;
    this.edicion = {
      nombre: t.nombre,
      fecha: (t.fecha ?? '').substring(0, 10),
      descripcion: t.descripcion ?? '',
      estado: t.estado,
    };
    this.api.ranking(t._id).subscribe({ next: (d) => this.detalle.set(d) });
  }

  guardarEdicion(): void {
    const t = this.seleccionado();
    if (!t) return;
    this.limpiar();
    const cambios: {
      nombre: string;
      fecha: string;
      descripcion: string;
      estado?: string;
    } = {
      nombre: this.edicion.nombre.trim(),
      fecha: this.edicion.fecha,
      descripcion: this.edicion.descripcion.trim(),
    };
    // Solo se envía el estado si el admin lo cambió (reabrir / pasar a Programado…)
    if (this.edicion.estado !== t.estado) cambios.estado = this.edicion.estado;
    this.api.editar(t._id, cambios).subscribe({
      next: () => {
        this.mensaje.set('Torneo actualizado.');
        this.cargar();
      },
      error: (e) =>
        this.error.set(
          extractErrorMessage(e, 'No se pudo actualizar el torneo'),
        ),
    });
  }

  finalizar(): void {
    const t = this.seleccionado();
    if (
      !t ||
      !confirm('¿Finalizar el torneo? Ya no se podrán registrar más tiempos.')
    )
      return;
    this.limpiar();
    this.api.finalizar(t._id).subscribe({
      next: () => {
        this.mensaje.set('Torneo finalizado.');
        this.cargar();
      },
      error: (e) =>
        this.error.set(
          extractErrorMessage(e, 'No se pudo finalizar el torneo'),
        ),
    });
  }

  eliminarTorneo(): void {
    const t = this.seleccionado();
    if (
      !t ||
      !confirm(
        `¿Eliminar "${t.nombre}" con todos sus tiempos? No se puede deshacer.`,
      )
    )
      return;
    this.limpiar();
    this.api.eliminar(t._id).subscribe({
      next: () => {
        this.seleccionar(null);
        this.mensaje.set('Torneo eliminado.');
        this.cargar();
      },
      error: (e) =>
        this.error.set(extractErrorMessage(e, 'No se pudo eliminar el torneo')),
    });
  }

  toggleStaff(id: string, marcado: boolean): void {
    this.staffSel.update((l) =>
      marcado ? [...new Set([...l, id])] : l.filter((x) => x !== id),
    );
  }

  guardarStaff(): void {
    const t = this.seleccionado();
    if (!t) return;
    this.limpiar();
    this.api.asignarStaff(t._id, this.staffSel()).subscribe({
      next: () => {
        this.mensaje.set('Staff asignado.');
        this.cargar();
      },
      error: (e) =>
        this.error.set(extractErrorMessage(e, 'No se pudo asignar el staff')),
    });
  }

  inscribir(): void {
    const t = this.seleccionado();
    if (!t || !this.robotId) return;
    this.limpiar();
    this.api.inscribirRobot(t._id, this.robotId).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.robotId = '';
        this.mensaje.set('Robot inscrito.');
      },
      error: (e) =>
        this.error.set(extractErrorMessage(e, 'No se pudo inscribir el robot')),
    });
  }

  quitarRobot(robotId: string, nombre: string): void {
    const t = this.seleccionado();
    if (
      !t ||
      !confirm(`¿Quitar a ${nombre} del torneo? Se pierden sus tiempos.`)
    )
      return;
    this.limpiar();
    this.api.quitarRobot(t._id, robotId).subscribe({
      next: (d) => {
        this.detalle.set(d);
        this.mensaje.set('Robot retirado.');
      },
      error: (e) =>
        this.error.set(extractErrorMessage(e, 'No se pudo quitar el robot')),
    });
  }

  private limpiar(): void {
    this.mensaje.set('');
    this.error.set('');
  }
}
