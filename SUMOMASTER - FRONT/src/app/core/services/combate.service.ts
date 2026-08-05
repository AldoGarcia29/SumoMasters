import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Combate,
  RegistrarResultadoPayload,
} from '../models/combate.model';
import { DojoResumen } from '../models/dojo.model';

@Injectable({ providedIn: 'root' })
export class CombateService {
  private readonly baseUrl = environment.coreApiUrl;

  constructor(private readonly http: HttpClient) {}

  findByTorneo(
    torneoId: string,
    filters?: { bloque?: string; dojo?: string; estado?: string; fase?: string },
  ): Observable<Combate[]> {
    let params = new HttpParams();
    if (filters?.bloque) params = params.set('bloque', filters.bloque);
    if (filters?.dojo) params = params.set('dojo', filters.dojo);
    if (filters?.estado) params = params.set('estado', filters.estado);
    if (filters?.fase) params = params.set('fase', filters.fase);

    return this.http.get<Combate[]>(`${this.baseUrl}/torneos/${torneoId}/combates`, { params });
  }

  generar(
    torneoId: string,
    payload: { bloqueId?: string; fase?: string },
  ): Observable<Combate[]> {
    return this.http.post<Combate[]>(
      `${this.baseUrl}/torneos/${torneoId}/combates/generar`,
      payload,
    );
  }

  resumenDojos(torneoId: string): Observable<DojoResumen[]> {
    return this.http.get<DojoResumen[]>(`${this.baseUrl}/torneos/${torneoId}/dojos-resumen`);
  }

  asignarDojosAutomatico(torneoId: string, fase?: string): Observable<Combate[]> {
    let params = new HttpParams();
    if (fase) params = params.set('fase', fase);
    return this.http.post<Combate[]>(
      `${this.baseUrl}/torneos/${torneoId}/combates/asignar-dojos-auto`,
      {},
      { params },
    );
  }

  asignarDojo(id: string, dojoId: string): Observable<Combate> {
    return this.http.patch<Combate>(`${this.baseUrl}/combates/${id}/dojo`, { dojo: dojoId });
  }

  quitarDojo(id: string): Observable<Combate> {
    return this.http.patch<Combate>(`${this.baseUrl}/combates/${id}/quitar-dojo`, {});
  }

  iniciar(id: string): Observable<Combate> {
    return this.http.patch<Combate>(`${this.baseUrl}/combates/${id}/iniciar`, {});
  }

  registrarResultado(id: string, payload: RegistrarResultadoPayload): Observable<Combate> {
    return this.http.patch<Combate>(`${this.baseUrl}/combates/${id}/resultado`, payload);
  }

  cancelar(id: string): Observable<Combate> {
    return this.http.patch<Combate>(`${this.baseUrl}/combates/${id}/cancelar`, {});
  }

  statsGlobal(): Observable<{ total: number; finalizados: number }> {
    return this.http.get<{ total: number; finalizados: number }>(
      `${this.baseUrl}/combates-stats`,
    );
  }
}
