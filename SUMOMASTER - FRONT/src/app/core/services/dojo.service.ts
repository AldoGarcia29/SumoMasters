import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Dojo, DojoPayload } from '../models/dojo.model';

@Injectable({ providedIn: 'root' })
export class DojoService {
  private readonly apiUrl = `${environment.coreApiUrl}/dojos`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Dojo[]> {
    return this.http.get<Dojo[]>(this.apiUrl);
  }

  create(payload: DojoPayload): Observable<Dojo> {
    return this.http.post<Dojo>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<DojoPayload>): Observable<Dojo> {
    return this.http.patch<Dojo>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }
}
