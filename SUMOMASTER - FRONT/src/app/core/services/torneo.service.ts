import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GrupoRoboSoccer, Torneo, TorneoPayload } from '../models/torneo.model';
import type {
  CambiarGanadorRoboSoccerPayload,
  GuardarLlaveRoboSoccerPayload,
  RespuestaLlaveRoboSoccer,
} from '../models/torneo.model';

@Injectable({ providedIn: 'root' })
export class TorneoService {
  private readonly apiUrl = `${environment.coreApiUrl}/torneos`;

  constructor(private readonly http: HttpClient) {}

  findAll(filters?: {
    search?: string;
    estado?: string;
    categoria?: string;
  }): Observable<Torneo[]> {
    let params = new HttpParams();

    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.estado) params = params.set('estado', filters.estado);
    if (filters?.categoria) params = params.set('categoria', filters.categoria);

    return this.http.get<Torneo[]>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Torneo> {
    return this.http.get<Torneo>(`${this.apiUrl}/${id}`);
  }

  create(payload: TorneoPayload): Observable<Torneo> {
    return this.http.post<Torneo>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<TorneoPayload>): Observable<Torneo> {
    return this.http.patch<Torneo>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }

  generarGrupos(id: string, cantidadGrupos: number): Observable<{ grupos: GrupoRoboSoccer[] }> {
  return this.http.post<{ grupos: GrupoRoboSoccer[] }>(
    `${this.apiUrl}/${id}/grupos/generar`,
    { cantidadGrupos },
  );
}


  registrarResultadoGrupo(
    torneoId: string,
    numeroGrupo: number,
    marcador: {
      localId: string;
      visitanteId: string;
      golesLocal: number;
      golesVisitante: number;
    },
  ): Observable<{ resultado: { golesLocal: number; golesVisitante: number } }> {
    return this.http.patch<{
      resultado: { golesLocal: number; golesVisitante: number };
    }>(
      `${this.apiUrl}/${torneoId}/grupos/${numeroGrupo}/resultado`,
      marcador,
    );
  }

  consultarLlaveRoboSoccer(
  torneoId: string,
): Observable<RespuestaLlaveRoboSoccer> {
  return this.http.get<RespuestaLlaveRoboSoccer>(
    `${this.apiUrl}/${torneoId}/llave-robo-soccer`,
  );
}

guardarLlaveRoboSoccer(
  torneoId: string,
  payload: GuardarLlaveRoboSoccerPayload,
): Observable<RespuestaLlaveRoboSoccer> {
  return this.http.patch<RespuestaLlaveRoboSoccer>(
    `${this.apiUrl}/${torneoId}/llave-robo-soccer`,
    payload,
  );
}

cambiarGanadorRoboSoccer(
  torneoId: string,
  cruceId: string,
  payload: CambiarGanadorRoboSoccerPayload,
): Observable<RespuestaLlaveRoboSoccer> {
  return this.http.patch<RespuestaLlaveRoboSoccer>(
    `${this.apiUrl}/${torneoId}/llave-robo-soccer/cruces/${encodeURIComponent(cruceId)}/ganador`,
    payload,
  );
}
}
