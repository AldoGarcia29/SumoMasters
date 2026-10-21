import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment'; // AJUSTA la ruta a tu environment
import { LiveData, RankingPublico, TorneoResumen } from '../models/live.model';

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  // AJUSTA: environment.coreApiUrl debe ser la URL base de tu API, ej. 'http://localhost:3000'
  private readonly base = `${environment.coreApiUrl}/public`;

  constructor(private http: HttpClient) {}

  getTorneos(): Observable<TorneoResumen[]> {
    return this.http.get<TorneoResumen[]>(`${this.base}/torneos`);
  }

  getLive(id: string): Observable<LiveData> {
    return this.http.get<LiveData>(`${this.base}/torneos/${id}/live`);
  }

  getRanking(id: string): Observable<RankingPublico> {
    return this.http.get<RankingPublico>(`${this.base}/torneos/${id}/ranking`);
  }
}
