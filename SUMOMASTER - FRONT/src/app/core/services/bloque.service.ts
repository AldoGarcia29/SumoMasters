import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Bloque, GenerarBloquesPayload } from '../models/bloque.model';

@Injectable({ providedIn: 'root' })
export class BloqueService {
  private readonly baseUrl = environment.coreApiUrl;

  constructor(private readonly http: HttpClient) {}

  findByTorneo(torneoId: string): Observable<Bloque[]> {
    return this.http.get<Bloque[]>(`${this.baseUrl}/torneos/${torneoId}/bloques`);
  }

  generar(torneoId: string, payload: GenerarBloquesPayload): Observable<Bloque[]> {
    return this.http.post<Bloque[]>(
      `${this.baseUrl}/torneos/${torneoId}/bloques/generar`,
      payload,
    );
  }
}
