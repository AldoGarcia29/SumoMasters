import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface RobotFichaDialogSelection {
  torneoId: string;
  robotId: string;
  numero: number | null;
  publico: boolean;
}

@Injectable({ providedIn: 'root' })
export class RobotFichaDialogService {
  private readonly selection = new BehaviorSubject<RobotFichaDialogSelection | null>(
    null,
  );

  readonly selection$ = this.selection.asObservable();

  open(selection: RobotFichaDialogSelection): void {
    this.selection.next(selection);
  }

  close(): void {
    this.selection.next(null);
  }
}
