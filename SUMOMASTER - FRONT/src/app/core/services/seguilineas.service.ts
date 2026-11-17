import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subscription, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EstadoRegistro,
  EstadoTurno,
  RankingSeguilineas,
  TorneoSeguilineas,
} from '../models/seguilineas.model';

const POLL_RESPALDO_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class SeguilineasService {
  private readonly url = `${environment.coreApiUrl}/seguilineas`;
  constructor(private readonly http: HttpClient) {}

  // ── ADMIN ──
  crear = (p: {
    nombre: string;
    fecha: string;
    descripcion?: string;
    staffIds?: string[];
  }) => this.http.post(this.url, p);
  editar = (
    id: string,
    p: {
      nombre?: string;
      fecha?: string;
      descripcion?: string;
      estado?: string;
    },
  ) => this.http.patch(`${this.url}/${id}`, p);
  eliminar = (id: string) => this.http.delete(`${this.url}/${id}`);
  asignarStaff = (id: string, staffIds: string[]) =>
    this.http.patch(`${this.url}/${id}/staff`, { staffIds });
  inscribirRobot = (id: string, robotId: string) =>
    this.http.post<RankingSeguilineas>(`${this.url}/${id}/participantes`, {
      robotId,
    });
  quitarRobot = (id: string, robotId: string) =>
    this.http.delete<RankingSeguilineas>(
      `${this.url}/${id}/participantes/${robotId}`,
    );

  // ── STAFF / ADMIN ──
  misTorneos = () =>
    this.http.get<TorneoSeguilineas[]>(`${this.url}/mis-torneos`);
  gestion = (id: string) =>
    this.http.get<RankingSeguilineas>(`${this.url}/${id}/gestion`);

  /** tiempoMs es obligatorio salvo que estado sea DNF o DESCALIFICADO. */
  registrarTiempo = (
    id: string,
    robotId: string,
    datos: { tiempoMs?: number; estado?: EstadoRegistro },
  ) =>
    this.http.post<RankingSeguilineas>(`${this.url}/${id}/tiempos`, {
      robotId,
      ...datos,
    });
  editarTiempo = (
    id: string,
    robotId: string,
    datos: { tiempoMs?: number; estado?: EstadoRegistro },
  ) =>
    this.http.patch<RankingSeguilineas>(
      `${this.url}/${id}/tiempos/${robotId}`,
      datos,
    );
  eliminarTiempo = (id: string, robotId: string) =>
    this.http.delete<RankingSeguilineas>(
      `${this.url}/${id}/tiempos/${robotId}`,
    );
  reordenarCola = (id: string, robotIds: string[]) =>
    this.http.patch<RankingSeguilineas>(`${this.url}/${id}/cola`, {
      robotIds,
    });
  marcarTurno = (id: string, robotId: string, estadoTurno: EstadoTurno) =>
    this.http.patch<RankingSeguilineas>(`${this.url}/${id}/turno/${robotId}`, {
      estadoTurno,
    });
  /** robotIds (opcional): orden manual entre robots empatados. */
  finalizar = (id: string, robotIds?: string[]) =>
    this.http.post<RankingSeguilineas>(
      `${this.url}/${id}/finalizar`,
      robotIds ? { robotIds } : {},
    );
  reordenarPodio = (id: string, robotIds: string[]) =>
    this.http.patch<RankingSeguilineas>(`${this.url}/${id}/podio`, {
      robotIds,
    });

  // ── PÚBLICO ──
  listar = (categoriaId?: string) =>
    this.http.get<TorneoSeguilineas[]>(
      this.url,
      categoriaId ? { params: { categoriaId } } : {},
    );
  ranking = (id: string): Observable<RankingSeguilineas> =>
    this.http.get<RankingSeguilineas>(`${this.url}/${id}/ranking`);
  activo = (): Observable<RankingSeguilineas | null> =>
    this.http.get<RankingSeguilineas | null>(`${this.url}/activo`);

  /**
   * Ranking en tiempo real por SSE (`GET :id/stream`). Si la conexión falla
   * (proxy que bufferiza, red caída…) cae a consultar `:id/ranking` cada 5 s
   * hasta que SSE se restablezca. Emite `null` si el torneo fue eliminado.
   * Los endpoints son públicos, por eso EventSource (sin cabeceras) basta.
   */
  streamRanking(id: string): Observable<RankingSeguilineas | null> {
    return new Observable<RankingSeguilineas | null>((obs) => {
      let poll: Subscription | null = null;
      const detenerPoll = () => {
        poll?.unsubscribe();
        poll = null;
      };
      const iniciarPoll = () => {
        if (poll) return;
        poll = timer(0, POLL_RESPALDO_MS).subscribe(() =>
          this.ranking(id).subscribe({
            next: (d) => obs.next(d),
            error: () => {},
          }),
        );
      };

      const es = new EventSource(`${this.url}/${id}/stream`);
      es.addEventListener('open', detenerPoll);
      es.addEventListener('ranking', (e) => {
        detenerPoll();
        obs.next(JSON.parse((e as MessageEvent<string>).data));
      });
      es.addEventListener('eliminado', () => obs.next(null));
      es.addEventListener('error', iniciarPoll);

      return () => {
        es.close();
        detenerPoll();
      };
    });
  }
}
