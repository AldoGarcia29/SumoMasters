import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface RobotVersus {
  _id: string;
  nombre: string;
  imagenUrl?: string;
  equipo?: { _id: string; nombre: string } | string | null;
}

export interface CombateVersus {
  _id: string;
  numero: number;
  fase: string;
  bloque: { _id: string; nombre: string } | null;
  dojo: { _id: string; nombre: string } | null;
  arena: number | null;
  turno: number | null;
  estado: string;
  resultado: string | null;
  robot1: RobotVersus | null;
  robot2: RobotVersus | null;
}

export interface ProyeccionVersus {
  torneo: { id: string; nombre: string };
  combate: CombateVersus | null;
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
      `${this.base}/torneos/${torneoId}/proyeccion`,
      { combateId },
    );
  }

  publico(torneoId: string) {
    return this.http.get<ProyeccionVersus>(
      `${this.base}/public/torneos/${torneoId}/versus`,
    );
  }
}