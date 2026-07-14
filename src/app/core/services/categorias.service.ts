import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Categoria } from '../interfaces/categoria.interface';

@Injectable({
  providedIn: 'root',
})
export class CategoriasService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    'http://localhost:3000/categorias';

  obtenerTodas(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.apiUrl);
  }

  obtenerActivas(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(
      `${this.apiUrl}/activas`,
    );
  }
}