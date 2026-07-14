import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CrearRobot,
  Robot,
} from '../interfaces/robot.interface';

@Injectable({
  providedIn: 'root',
})
export class RobotsService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000/robots';

  obtenerTodos(): Observable<Robot[]> {
    return this.http.get<Robot[]>(this.apiUrl);
  }

  obtenerPorId(id: string): Observable<Robot> {
    return this.http.get<Robot>(`${this.apiUrl}/${id}`);
  }

  obtenerPorEquipo(equipoId: string): Observable<Robot[]> {
    return this.http.get<Robot[]>(
      `${this.apiUrl}/equipo/${equipoId}`,
    );
  }

  crear(robot: CrearRobot): Observable<Robot> {
    return this.http.post<Robot>(this.apiUrl, robot);
  }

  actualizar(
    id: string,
    robot: Partial<CrearRobot>,
  ): Observable<Robot> {
    return this.http.patch<Robot>(
      `${this.apiUrl}/${id}`,
      robot,
    );
  }

  eliminar(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}