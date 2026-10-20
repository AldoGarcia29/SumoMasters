import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Robot, RobotPayload } from '../models/robot.model';

@Injectable({ providedIn: 'root' })
export class RobotService {
  private readonly apiUrl = `${environment.coreApiUrl}/robots`;

  constructor(private readonly http: HttpClient) {}

  findAll(filters?: {
    search?: string;
    equipo?: string;
    categoria?: string;
    estado?: string;
  }): Observable<Robot[]> {
    let params = new HttpParams();

    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.equipo) params = params.set('equipo', filters.equipo);
    if (filters?.categoria) params = params.set('categoria', filters.categoria);
    if (filters?.estado) params = params.set('estado', filters.estado);

    return this.http.get<Robot[]>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Robot> {
    return this.http.get<Robot>(`${this.apiUrl}/${id}`);
  }

  create(payload: RobotPayload): Observable<Robot> {
    return this.http.post<Robot>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<RobotPayload>): Observable<Robot> {
    return this.http.patch<Robot>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }
}
