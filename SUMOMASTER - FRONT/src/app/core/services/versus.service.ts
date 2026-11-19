import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface RobotVersus {
  _id: string;
  nombre: string;
  imagenUrl?: string | null;
  equipo?: { _id: string; nombre: string } | string | null;
}

export interface CombateVersus {
  _id: string;
  numero: number;
  fase: string;

  ronda?: number | null;
  horarioProgramado?: string | null;

  bloque: { _id: string; nombre: string } | null;
  dojo: { _id: string; nombre: string } | null;
  arena: number | null;
  turno: number | null;
  estado: string;
  resultado: string | null;
  robot1: RobotVersus | null;
  robot2: RobotVersus | null;
  placeholder1?: string | null;
  placeholder2?: string | null;
}

export interface ProyeccionVersus {
  torneo: { id: string; nombre: string };
  combate: CombateVersus | null;
  dojosActivos?: number;
  lote?: CombatePantalla[];
}

export interface RobotPantalla {
  nombre: string;
  numero: number | null;
  imagenUrl: string | null;
}

export interface CombatePantalla {
  id: string;
  numero: number;
  fase: string;
  bloque: string | null;
  dojo: string | null;
  arena: number | null;
  turno: number | null;
  estado: string;
  robot1: RobotPantalla;
  robot2: RobotPantalla;
  esPrincipal: boolean;
}

export interface PantallasTorneo {
  torneo: { id: string; nombre: string };
  dojosActivos: number;
  dojosDisponibles: number;
  combateProyectado: string | null;
  lote: CombatePantalla[];
  despues: CombatePantalla[];
}

@Injectable({ providedIn: 'root' })
export class VersusService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.coreApiUrl.replace(/\/$/, '');

  combates(torneoId: string) {
    return this.http.get<CombateVersus[]>(
      `${this.base}/torneos/${torneoId}/combates`,
    );
  }

  seleccionActual(torneoId: string) {
    return this.http.get<{
      combateId: string | null;
      publico: boolean;
    }>(`${this.base}/torneos/${torneoId}/proyeccion`);
  }

  mostrar(torneoId: string, combateId: string | null) {
  return this.http.patch(
    `${this.base}/proyeccion/principal`,
    {
      torneoId,
      combateId,
    },
  );
}

publicoPrincipal(torneoId?: string) {
  return this.http.get<ProyeccionVersus | null>(
    `${this.base}/public/versus/principal`,
    { params: torneoId ? { torneo: torneoId } : {} },
  );
}

pantallas(torneoId: string) {
  return this.http.get<PantallasTorneo>(
    `${this.base}/torneos/${torneoId}/pantallas`,
  );
}

actualizarPantallas(
  torneoId: string,
  cambios: { dojosActivos?: number; combateProyectado?: string | null },
) {
  return this.http.patch<{ dojosActivos: number; combateProyectado: string | null }>(
    `${this.base}/torneos/${torneoId}/pantallas`,
    cambios,
  );
}

  publico(torneoId: string) {
    return this.http.get<ProyeccionVersus>(
      `${this.base}/public/torneos/${torneoId}/versus`,
    );
  }

  seleccionPrincipal() {
  return this.http.get<{
    torneoId: string | null;
    combateId: string | null;
  }>(
    `${this.base}/proyeccion/principal`,
  );
}
}