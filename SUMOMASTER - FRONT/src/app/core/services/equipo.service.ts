import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Equipo, EquipoPayload } from '../models/equipo.model';

@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly apiUrl = `${environment.coreApiUrl}/equipos`;

  constructor(private readonly http: HttpClient) {}

  findAll(filters?: { search?: string; categoria?: string }): Observable<Equipo[]> {
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.categoria) {
      params = params.set('categoria', filters.categoria);
    }

    return this.http.get<Equipo[]>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Equipo> {
    return this.http.get<Equipo>(`${this.apiUrl}/${id}`);
  }

  create(payload: EquipoPayload): Observable<Equipo> {
    return this.http.post<Equipo>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<EquipoPayload>): Observable<Equipo> {
    return this.http.patch<Equipo>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }
}
