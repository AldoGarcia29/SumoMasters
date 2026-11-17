import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

import {
  PROGRAMA_VACIO,
  ProgramaCombate,
  ProgramaVista,
  construirPrograma,
} from './programa.util';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Vista "tipo Excel" del torneo: grupos, rondas por hora/dojo y llaves de finales. */
@Component({
  selector: 'app-programa-torneo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './programa-torneo.component.html',
  styleUrls: ['./programa-torneo.component.css'],
})
export class ProgramaTorneoComponent implements OnChanges {
  @Input() combates: ProgramaCombate[] = [];
  /** Resalta al robot buscado (el mismo texto del buscador de la página). */
  @Input() busca = '';

  vista: ProgramaVista = PROGRAMA_VACIO;
  private q = '';

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['combates']) this.vista = construirPrograma(this.combates);
    if (ch['busca']) this.q = norm(this.busca.trim());
  }

  resalta(nombre: string | null): boolean {
    return !!this.q && !!nombre && norm(nombre).includes(this.q);
  }

  get hayDatos(): boolean {
    return this.vista.rondas.length > 0 || this.vista.etapas.length > 0;
  }
}
