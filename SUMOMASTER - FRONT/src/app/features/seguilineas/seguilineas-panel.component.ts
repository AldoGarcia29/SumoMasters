import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, catchError, exhaustMap, timer } from 'rxjs';
import { RankingSeguilineas, formatearTiempo } from '../../core/models/seguilineas.model';
import { SeguilineasService } from '../../core/services/seguilineas.service';

@Component({
  selector: 'app-seguilineas-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="sl" *ngIf="data() as d">
      <h1>{{ d.nombre }} <small>Seguilineas</small></h1>

      <form *ngIf="!soloLectura" (ngSubmit)="registrar()" class="sl__form">
        <select [(ngModel)]="robotId" name="robot" required>
          <option value="" disabled>Robot…</option>
          <option *ngFor="let f of d.ranking" [value]="f.robotId">#{{ f.ordenLlegada }} {{ f.nombre }}</option>
        </select>
        <input type="number" min="0" [(ngModel)]="min" name="min" placeholder="min" />
        <input type="number" min="0" max="59" [(ngModel)]="seg" name="seg" placeholder="seg" />
        <input type="number" min="0" max="999" [(ngModel)]="ms" name="ms" placeholder="ms" />
        <button [disabled]="!robotId || !tiempoMs">Registrar tiempo</button>
        <p class="sl__error" *ngIf="error()">{{ error() }}</p>
      </form>

      <table>
        <tr><th>#</th><th>Robot</th><th>Mejor tiempo</th><th>Intentos</th></tr>
        <tr *ngFor="let f of d.ranking; trackBy: trackFila">
          <td>{{ f.posicion }}</td><td>{{ f.nombre }}</td>
          <td>{{ fmt(f.mejorTiempoMs) }}</td><td>{{ f.intentos }}</td>
        </tr>
      </table>
    </section>
    <p *ngIf="!data() && error()">{{ error() }}</p>`,
})
export class SeguilineasPanelComponent implements OnInit {
  private readonly api = inject(SeguilineasService);
  private readonly route = inject(ActivatedRoute);

  readonly soloLectura = !!this.route.snapshot.data['soloLectura'];
  readonly data = signal<RankingSeguilineas | null>(null);
  readonly error = signal('');
  readonly fmt = formatearTiempo;
  robotId = ''; min = 0; seg = 0; ms = 0;

  get tiempoMs(): number { return (this.min || 0) * 60_000 + (this.seg || 0) * 1_000 + (this.ms || 0); }
  trackFila = (_: number, f: { robotId: string }) => f.robotId;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const fuente = () => (this.soloLectura ? this.api.ranking(id) : this.api.gestion(id));
    timer(0, 5_000).pipe(
      exhaustMap(() => fuente().pipe(catchError((e) => { this.error.set(e.error?.message ?? 'Sin acceso a este torneo'); return EMPTY; }))),
    ).subscribe((d) => { this.data.set(d); this.error.set(''); });
  }

  registrar(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.registrarTiempo(id, this.robotId, this.tiempoMs).subscribe({
      next: (d) => { this.data.set(d); this.min = this.seg = this.ms = 0; this.error.set(''); },
      error: (e) => this.error.set(e.error?.message ?? 'No se pudo registrar el tiempo'),
    });
  }
}
