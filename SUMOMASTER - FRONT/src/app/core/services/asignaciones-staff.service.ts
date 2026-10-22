import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export interface AsignacionStaff { _id: string; usuario: string; torneo: string; dojo: string; fecha: string; }
@Injectable({ providedIn: 'root' })
export class AsignacionesStaffService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.coreApiUrl;
  crear(usuarioId: string, torneoId: string, dojoId: string, fecha: string): Observable<AsignacionStaff> {
    return this.http.post<AsignacionStaff>(`${this.url}/asignaciones-staff`, { usuarioId, torneoId, dojoId, fecha });
  }
  todas(): Observable<AsignacionStaff[]> { return this.http.get<AsignacionStaff[]>(`${this.url}/asignaciones-staff`); }
  mias(): Observable<AsignacionStaff[]> { return this.http.get<AsignacionStaff[]>(`${this.url}/mis-asignaciones`); }
  eliminar(id: string): Observable<unknown> { return this.http.delete(`${this.url}/asignaciones-staff/${id}`); }
}
