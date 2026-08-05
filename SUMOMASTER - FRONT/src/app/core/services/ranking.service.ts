import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FilaRanking } from '../models/ranking.model';

@Injectable({ providedIn: 'root' })
export class RankingService {
  private readonly baseUrl = environment.coreApiUrl;

  constructor(private readonly http: HttpClient) {}

  calcular(
    torneoId: string,
    filtros?: { bloque?: string; dojo?: string },
  ): Observable<FilaRanking[]> {
    let params = new HttpParams();
    if (filtros?.bloque) params = params.set('bloque', filtros.bloque);
    if (filtros?.dojo) params = params.set('dojo', filtros.dojo);

    return this.http.get<FilaRanking[]>(`${this.baseUrl}/torneos/${torneoId}/ranking`, {
      params,
    });
  }
}
