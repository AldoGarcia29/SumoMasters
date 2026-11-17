import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AsignacionStaff {
  _id: string;
  usuario: string;
  torneo: string;
  dojo: string;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class AsignacionesStaffService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.coreApiUrl;
  mias(): Observable<AsignacionStaff[]> {
    return this.http.get<AsignacionStaff[]>(`${this.base}/mis-asignaciones`);
  }
  todas(): Observable<AsignacionStaff[]> {
    return this.http.get<AsignacionStaff[]>(`${this.base}/asignaciones-staff`);
  }
  crear(usuarioId: string, torneoId: string, dojoId: string, fecha: string): Observable<AsignacionStaff> {
    return this.http.post<AsignacionStaff>(`${this.base}/asignaciones-staff`,
      { usuarioId, torneoId, dojoId, fecha });
  }
  eliminar(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/asignaciones-staff/${id}`);
  }
}
