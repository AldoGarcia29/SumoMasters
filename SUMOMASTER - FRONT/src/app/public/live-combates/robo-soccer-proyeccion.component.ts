import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, of, ReplaySubject, switchMap, timer } from 'rxjs';

import { TipoCombate } from '../../core/models/categoria.model';
import { TorneoService } from '../../core/services/torneo.service';
import type { Torneo } from '../../core/models/torneo.model';
@Component({
  selector: 'app-robo-soccer-proyeccion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './robo-soccer-proyeccion.component.html',
  styleUrl: './robo-soccer-proyeccion.component.css',
})
export class RoboSoccerProyeccionComponent {
  private readonly servicio = inject(TorneoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly torneoId$ = new ReplaySubject<string>(1);

  @Input({ required: true })
  set torneoId(id: string) {
    this.torneoId$.next(id);
  }

  readonly cantidades = [1, 2, 3, 4, 5, 6];
  readonly cantidad = signal(1);
  readonly seleccion = signal<string[]>(Array.from({ length: 6 }, () => ''));
  readonly aviso = signal('');
  readonly torneo = signal<Torneo | null>(null);
  

  readonly partidos = computed(() => {
    const torneo = this.torneo();
    if (!torneo) return [];

    const nombres = new Map<string, string>();
    for (const equipo of torneo.equiposInscritos ?? []) {
      if (typeof equipo !== 'string') nombres.set(equipo._id, equipo.nombre);
    }

    return (torneo.gruposRoboSoccer ?? []).flatMap((grupo) =>
      grupo.partidos.map((partido) => ({
        id: `${grupo.numero}-${partido.localId}-${partido.visitanteId}`,
        fase: grupo.nombre,
        local: nombres.get(partido.localId) ?? 'Equipo local',
        visitante: nombres.get(partido.visitanteId) ?? 'Equipo visitante',
        resultado: partido.resultado,
      })),
    );
  });

  readonly tarjetas = computed(() => {
    const partidos = new Map(this.partidos().map((partido) => [partido.id, partido]));

    return this.seleccion().slice(0, this.cantidad()).map((id, indice) => ({
      indice,
      partido: partidos.get(id) ?? null,
    }));
  });

  constructor() {
    this.torneoId$.pipe(
      switchMap((id) => {
        this.torneo.set(null);
        this.seleccion.set(this.seleccion().map(() => ''));
        this.aviso.set('Cargando partidos…');

        return timer(0, 5000).pipe(
          exhaustMap(() =>
            this.servicio.findOne(id).pipe(catchError(() => of(null))),
          ),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((torneo) => {
      if (!torneo) {
        this.aviso.set('No se pudo actualizar la proyección. Reintentando…');
        return;
      }

      const categoria = torneo.categoria;
      if (typeof categoria === 'string' || categoria?.tipoCombate !== TipoCombate.ROBO_SOCCER_RC) {
        this.torneo.set(null);
        this.aviso.set('Selecciona un torneo de Robo Soccer RC.');
        return;
      }

      this.torneo.set(torneo);
      this.aviso.set(this.partidos().length ? '' : 'Genera los grupos para proyectar partidos.');
    });
  }

  cambiarCantidad(valor: string): void {
    const cantidad = Number(valor);
    if (this.cantidades.includes(cantidad)) this.cantidad.set(cantidad);
  }

  elegirPartido(indice: number, id: string): void {
    this.seleccion.update((actual) =>
      actual.map((seleccionado, posicion) => {
        if (posicion === indice) return id;
        return seleccionado === id ? '' : seleccionado;
      }),
    );
  }
}