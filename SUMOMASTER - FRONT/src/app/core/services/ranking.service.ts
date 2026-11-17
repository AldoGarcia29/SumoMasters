import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FilaRanking } from '../models/ranking.model';
import { PodioTorneo } from '../models/podio.model';

import {
  FaseEliminatoriaGenerada,
  ResumenClasificados,
} from '../models/clasificados.model';

import {
  Combate,
  FaseCombate,
} from '../models/combate.model';

@Injectable({ providedIn: 'root' })
export class RankingService {

  generarCuadroManual(
  torneoId: string,
  payload: {
    faseInicial: FaseCombate;
    cruces: Array<{
      robot1Id: string;
      robot2Id: string;
    }>;
  },
): Observable<{
  faseInicial: FaseCombate;
  combatesGenerados: Combate[];
  mensaje: string;
}> {
  return this.http.post<{
    faseInicial: FaseCombate;
    combatesGenerados: Combate[];
    mensaje: string;
  }>(
    `${this.baseUrl}/torneos/${torneoId}/ranking/cuadro-manual/generar`,
    payload,
  );
}

  private readonly baseUrl = environment.coreApiUrl;

  constructor(private readonly http: HttpClient) {}

  calcular(
    torneoId: string,
    filtros?: { bloque?: string; dojo?: string },
  ): Observable<FilaRanking[]> {
    let params = new HttpParams();
    if (filtros?.bloque) params = params.set('bloque', filtros.bloque);
    if (filtros?.dojo) params = params.set('dojo', filtros.dojo);

    return this.http.get<FilaRanking[]>(`${this.baseUrl}/torneos/${torneoId}/ranking`, {
      params,
    });
  }

  obtenerClasificados(
  torneoId: string,
): Observable<ResumenClasificados> {
  return this.http.get<ResumenClasificados>(
    `${this.baseUrl}/torneos/${torneoId}/ranking/clasificados`,
  );
}

obtenerPodio(
  torneoId: string,
): Observable<PodioTorneo> {
  return this.http.get<PodioTorneo>(
    `${this.baseUrl}/torneos/${torneoId}/ranking/podio`,
  );
}

generarFaseEliminatoria(
  torneoId: string,
): Observable<FaseEliminatoriaGenerada> {
  return this.http.post<FaseEliminatoriaGenerada>(
    `${this.baseUrl}/torneos/${torneoId}/ranking/fase-eliminatoria/generar`,
    {},
  );
}


generarSiguienteRonda(
  torneoId: string,
  faseActual: FaseCombate,
): Observable<{
  faseActual: FaseCombate;
  siguienteFase: FaseCombate;
  participantes: number;
  combatesGenerados: Combate[];
}> {
  return this.http.post<{
    faseActual: FaseCombate;
    siguienteFase: FaseCombate;
    participantes: number;
    combatesGenerados: Combate[];
  }>(
    `${this.baseUrl}/torneos/${torneoId}/ranking/siguiente-ronda/generar`,
    { faseActual },
  );
}
}
