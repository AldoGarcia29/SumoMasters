import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CrearEquipo,
  Equipo,
} from '../interfaces/equipo.interface';

@Injectable({
  providedIn: 'root',
})
export class EquiposService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000/equipos';

  obtenerTodos(): Observable<Equipo[]> {
    return this.http.get<Equipo[]>(this.apiUrl);
  }

  obtenerPorId(id: string): Observable<Equipo> {
    return this.http.get<Equipo>(`${this.apiUrl}/${id}`);
  }

  crear(equipo: CrearEquipo): Observable<Equipo> {
    return this.http.post<Equipo>(this.apiUrl, equipo);
  }

  actualizar(
    id: string,
    equipo: Partial<CrearEquipo>,
  ): Observable<Equipo> {
    return this.http.patch<Equipo>(
      `${this.apiUrl}/${id}`,
      equipo,
    );
  }

  eliminar(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}