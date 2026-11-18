import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EventoConfig,
  EventoConfigUpdate,
} from '../models/evento-config.model';

@Injectable({ providedIn: 'root' })
export class EventoConfigService {
  private readonly url = `${environment.coreApiUrl}/evento/configuracion`;

  constructor(private readonly http: HttpClient) {}

  obtener(): Observable<EventoConfig> {
    return this.http.get<EventoConfig>(this.url);
  }

  actualizar(cambios: EventoConfigUpdate): Observable<EventoConfig> {
    return this.http.patch<EventoConfig>(this.url, cambios);
  }
}
