import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';

export interface SeguilineasEvento {
  torneoId: string;
  tipo: 'ranking' | 'eliminado';
  payload: unknown;
}

@Injectable()
export class SeguilineasEventsService {
  private readonly bus = new Subject<SeguilineasEvento>();

  publicar(evento: SeguilineasEvento): void {
    this.bus.next(evento);
  }

  todos(): Observable<SeguilineasEvento> {
    return this.bus.asObservable();
  }

  deTorneo(torneoId: string): Observable<SeguilineasEvento> {
    return this.bus.pipe(filter((e) => e.torneoId === torneoId));
  }
}
