import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin, Observable } from 'rxjs';

import type {
  CruceInicialRoboSoccer,
  CruceLlaveRoboSoccer,
  RespuestaLlaveRoboSoccer,
  RondaInicialRoboSoccer,
  Torneo,
} from '../../core/models/torneo.model';
import { TorneoService } from '../../core/services/torneo.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

const RONDAS = {
  DIECISEISAVOS: { nombre: 'Dieciseisavos', cruces: 16 },
  OCTAVOS: { nombre: 'Octavos', cruces: 8 },
  CUARTOS: { nombre: 'Cuartos', cruces: 4 },
  SEMIFINAL: { nombre: 'Semifinales', cruces: 2 },
  FINAL: { nombre: 'Final', cruces: 1 },
} satisfies Record<RondaInicialRoboSoccer, { nombre: string; cruces: number }>;

@Component({
  selector: 'app-torneo-llaves-soccer',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneo-llaves-soccer.component.html',
  styleUrl: './torneo-llaves-soccer.component.scss',
})
export class TorneoLlavesSoccerComponent implements OnInit {
  private readonly servicio = inject(TorneoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly torneoId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly torneo = signal<Torneo | null>(null);
  readonly respuesta = signal<RespuestaLlaveRoboSoccer | null>(null);
  readonly ronda = signal<RondaInicialRoboSoccer>('FINAL');
  readonly cruces = signal<CruceInicialRoboSoccer[]>([
    { localId: null, visitanteId: null },
  ]);
  readonly filtro = signal('TODAS');
  readonly sidebarOpen = signal(false);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly cambios = signal(false);
  readonly error = signal('');
  readonly rondas = RONDAS;
  readonly opciones = Object.keys(RONDAS) as RondaInicialRoboSoccer[];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    if (!this.torneoId) {
      this.error.set('No se encontró el torneo.');
      this.cargando.set(false);
      return;
    }

    this.error.set('');
    this.cargando.set(true);
    forkJoin({
      torneo: this.servicio.findOne(this.torneoId),
      llave: this.servicio.consultarLlaveRoboSoccer(this.torneoId),
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: ({ torneo, llave }) => {
        this.torneo.set(torneo);
        this.aplicar(llave);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'No se pudo cargar la llave.'));
      },
    });
  }

  elegirRonda(valor: string): void {
    const ronda = this.opciones.find((item) => item === valor);
    if (!ronda || ronda === this.ronda()) return;

    if (!window.confirm('Cambiar la ronda vaciará los cruces del formulario. ¿Continuar?')) {
      return;
    }

    this.ronda.set(ronda);
    this.cruces.set(this.completarCruces(ronda, []));
    this.cambios.set(true);
  }

  asignar(indice: number, lado: keyof CruceInicialRoboSoccer, valor: string): void {
    this.cruces.update((cruces) =>
      cruces.map((cruce, i) => i === indice ? { ...cruce, [lado]: valor || null } : cruce),
    );
    this.cambios.set(true);
  }

  ocupado(id: string, indice: number, lado: keyof CruceInicialRoboSoccer): boolean {
    return this.cruces().some((cruce, i) =>
      (cruce.localId === id && (i !== indice || lado !== 'localId')) ||
      (cruce.visitanteId === id && (i !== indice || lado !== 'visitanteId')),
    );
  }

  equipoId(equipo: string | { _id: string }): string {
    return typeof equipo === 'string' ? equipo : equipo._id;
  }

  nombre(id: string | null): string {
    if (!id) return 'Por definir';

    const equipo = this.torneo()?.equiposInscritos?.find((item) => this.equipoId(item) === id);
    return typeof equipo === 'object' ? equipo.nombre : id;
  }

  guardar(): void {
    if (this.guardando()) return;

    this.enviar(this.servicio.guardarLlaveRoboSoccer(this.torneoId, {
      rondaInicial: this.ronda(),
      crucesIniciales: this.cruces(),
    }));
  }

  elegirGanador(cruce: CruceLlaveRoboSoccer, ganadorId: string | null): void {
    const { localId, visitanteId } = cruce;

    if (
      !localId || !visitanteId ||
      this.guardando() || this.cambios() ||
      ganadorId === cruce.ganadorId ||
      (ganadorId !== localId && ganadorId !== visitanteId)
    ) return;

    if (
      cruce.ganadorId &&
      !window.confirm('Cambiar el ganador puede dejar pendientes resultados de rondas posteriores. ¿Continuar?')
    ) return;

    this.enviar(this.servicio.cambiarGanadorRoboSoccer(this.torneoId, cruce.id, {
      localId,
      visitanteId,
      ganadorId,
    }));
  }

  private completarCruces(
    ronda: RondaInicialRoboSoccer,
    cruces: readonly CruceInicialRoboSoccer[],
  ): CruceInicialRoboSoccer[] {
    return Array.from({ length: RONDAS[ronda].cruces }, (_, i) =>
      cruces[i] ?? { localId: null, visitanteId: null },
    );
  }

  private aplicar(respuesta: RespuestaLlaveRoboSoccer): void {
    this.respuesta.set(respuesta);
    const ronda = respuesta.llave?.rondaInicial ?? 'FINAL';
    this.ronda.set(ronda);
    this.cruces.set(this.completarCruces(ronda, respuesta.llave?.crucesIniciales ?? []));
    this.cambios.set(false);
  }

  private enviar(peticion: Observable<RespuestaLlaveRoboSoccer>): void {
    this.error.set('');
    this.guardando.set(true);

    peticion.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.guardando.set(false)),
    ).subscribe({
      next: (respuesta) => this.aplicar(respuesta),
      error: (err) => this.error.set(
        extractErrorMessage(err, 'No se pudo guardar la llave.'),
      ),
    });
  }
}