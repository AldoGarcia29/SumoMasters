import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RankingSeguilineas } from '../models/seguilineas.model';

@Injectable({ providedIn: 'root' })
export class SeguilineasService {
  private readonly url = `${environment.coreApiUrl}/seguilineas`;
  constructor(private readonly http: HttpClient) {}

  crear = (p: { nombre: string; fecha: string; descripcion?: string; staffIds?: string[] }) => this.http.post(this.url, p);
  asignarStaff = (id: string, staffIds: string[]) => this.http.patch(`${this.url}/${id}/staff`, { staffIds });
  inscribirRobot = (id: string, robotId: string) => this.http.post<RankingSeguilineas>(`${this.url}/${id}/participantes`, { robotId });
  misTorneos = () => this.http.get<{ _id: string; nombre: string; estado: string }[]>(`${this.url}/mis-torneos`);
  gestion = (id: string) => this.http.get<RankingSeguilineas>(`${this.url}/${id}/gestion`);
  registrarTiempo = (id: string, robotId: string, tiempoMs: number) => this.http.post<RankingSeguilineas>(`${this.url}/${id}/tiempos`, { robotId, tiempoMs });
  ranking = (id: string): Observable<RankingSeguilineas> => this.http.get<RankingSeguilineas>(`${this.url}/${id}/ranking`);
  activo = (): Observable<RankingSeguilineas | null> => this.http.get<RankingSeguilineas | null>(`${this.url}/activo`);
}
