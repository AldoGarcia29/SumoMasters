import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Categoria, CategoriaPayload } from '../models/categoria.model';

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private readonly apiUrl = `${environment.coreApiUrl}/categorias`;

  constructor(private readonly http: HttpClient) {}

  findAll(filters?: { search?: string; estado?: string }): Observable<Categoria[]> {
    let params = new HttpParams();

    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    if (filters?.estado) {
      params = params.set('estado', filters.estado);
    }

    return this.http.get<Categoria[]>(this.apiUrl, { params });
  }

  findOne(id: string): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.apiUrl}/${id}`);
  }

  create(payload: CategoriaPayload): Observable<Categoria> {
    return this.http.post<Categoria>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<CategoriaPayload>): Observable<Categoria> {
    return this.http.patch<Categoria>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }
}
