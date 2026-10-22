import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  VersusService,
  CombateVersus,
} from '../../core/services/versus.service';

@Component({
  selector: 'app-control-versus',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="control">
      <header>
        <div>
          <a [routerLink]="['/torneos', torneoId, 'dojos']">
            ← Volver a dojos
          </a>
          <h1>Control de pantalla pública</h1>
          <p>Selecciona el combate que verá el público.</p>
        </div>

        <a
          class="btn"
          [routerLink]="['/versus', torneoId]"
          target="_blank"
          rel="noopener"
        >
          Abrir pantalla pública ↗
        </a>
      </header>

      <p class="error" *ngIf="error()">{{ error() }}</p>
      <p class="ok" *ngIf="mensaje()">{{ mensaje() }}</p>

      <section class="filtros">
        <label>
          Bloque
          <select
            [value]="bloqueId()"
            (change)="cambiarBloque($any($event.target).value)"
          >
            <option value="">Todos los bloques</option>
            <option *ngFor="let b of bloques()" [value]="b._id">
              {{ b.nombre }}
            </option>
          </select>
        </label>

        <label>
          Dojo
          <select
            [value]="dojoId()"
            (change)="cambiarDojo($any($event.target).value)"
          >
            <option value="">Selecciona un dojo</option>
            <option *ngFor="let d of dojos()" [value]="d._id">
              {{ d.nombre }}
            </option>
          </select>
        </label>

        <label>
          Arena
          <select
            [value]="arena()"
            (change)="arena.set($any($event.target).value)"
          >
            <option value="">Todas las arenas</option>
            <option *ngFor="let a of arenas()" [value]="a">
              Arena {{ a }}
            </option>
          </select>
        </label>
      </section>

      <section class="lista">
        <div class="titulo">
          <h2>Combates disponibles ({{ filtrados().length }})</h2>
          <button class="secundario" (click)="cargar()" [disabled]="cargando()">
            {{ cargando() ? 'Cargando…' : 'Actualizar lista' }}
          </button>
        </div>

        <p *ngIf="!dojoId()">Selecciona un dojo para ver sus combates.</p>
        <p *ngIf="dojoId() && !filtrados().length && !cargando()">
          No hay combates para estos filtros.
        </p>

        <article
          *ngFor="let c of filtrados()"
          [class.activo]="proyectadoId() === c._id"
        >
          <div>
            <small>
              {{ c.bloque?.nombre || c.fase }}
              · Turno {{ c.turno ?? '—' }}
              · Arena {{ c.arena ?? '—' }}
            </small>
            <h3>
              #{{ c.numero }}
              {{ c.robot1?.nombre || c.placeholder1 || 'Por definir' }}
              <span>VS</span>
              {{ c.robot2?.nombre || c.placeholder2 || 'Por definir' }}
            </h3>
            <small>
              {{ c.estado }}
              {{ proyectadoId() === c._id ? ' · EN PANTALLA' : '' }}
            </small>
          </div>

          <button
            class="btn"
            (click)="mostrar(c)"
            [disabled]="guardando() || !c.robot1 || !c.robot2"
          >
            {{ proyectadoId() === c._id ? 'Volver a mostrar' : 'Mostrar al público' }}
          </button>
        </article>

        <button
          class="secundario"
          (click)="quitar()"
          [disabled]="guardando() || !proyectadoId()"
        >
          Dejar pantalla en espera
        </button>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#f5f2fc; color:#24163d; }
    .control { max-width:1200px; margin:auto; padding:32px; }
    header,.titulo,article { display:flex; justify-content:space-between; gap:24px; align-items:center; }
    h1 { margin-bottom:8px; }
    a { color:#7233df; }
    .filtros,.lista { background:white; padding:24px; border:1px solid #e7ddfa; border-radius:18px; margin-top:24px; }
    .filtros { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
    label { display:grid; gap:10px; font-weight:600; }
    select { width:100%; padding:13px; border:1px solid #ded2f7; border-radius:10px; background:#f8f5ff; }
    article { padding:20px; border:1px solid #e8e0f5; border-radius:12px; margin:14px 0; }
    article.activo { border:2px solid #7c3aed; background:#f5efff; }
    h3 span { color:#8b5cf6; margin:0 12px; }
    small { color:#776b89; }
    button,.btn { cursor:pointer; font:inherit; border:0; border-radius:10px; padding:12px 18px; }
    .btn { background:#7835e5; color:white; text-decoration:none; text-align:center; }
    .secundario { background:#eee7fa; color:#53248d; }
    button:disabled { opacity:.5; cursor:default; }
    .error,.ok { padding:16px; border-radius:10px; }
    .error { background:#fee2e2; color:#991b1b; }
    .ok { background:#dcfce7; color:#166534; }
    @media(max-width:700px) {
      .control { padding:18px; }
      header,article,.titulo { align-items:stretch; flex-direction:column; }
      .filtros { grid-template-columns:1fr; }
    }
  `],
})
export class ControlVersusComponent implements OnInit {
  private readonly api = inject(VersusService);
  private readonly route = inject(ActivatedRoute);

  readonly torneoId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly combates = signal<CombateVersus[]>([]);
  readonly bloqueId = signal('');
  readonly dojoId = signal('');
  readonly arena = signal('');
  readonly proyectadoId = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly bloques = computed(() => {
    const mapa = new Map<string, { _id: string; nombre: string }>();
    for (const c of this.combates()) {
      if (c.bloque) mapa.set(c.bloque._id, c.bloque);
    }
    return [...mapa.values()];
  });

  private readonly porBloque = computed(() =>
    this.combates().filter(
      c => !this.bloqueId() || c.bloque?._id === this.bloqueId(),
    ),
  );

  readonly dojos = computed(() => {
    const mapa = new Map<string, { _id: string; nombre: string }>();
    for (const c of this.porBloque()) {
      if (c.dojo) mapa.set(c.dojo._id, c.dojo);
    }
    return [...mapa.values()];
  });

  readonly arenas = computed(() =>
    [...new Set(
      this.porBloque()
        .filter(c => c.dojo?._id === this.dojoId())
        .map(c => c.arena)
        .filter((a): a is number => a !== null && a !== undefined),
    )].sort((a, b) => a - b),
  );

  readonly filtrados = computed(() => {
    if (!this.dojoId()) return [];

    return this.porBloque()
      .filter(c =>
        c.dojo?._id === this.dojoId() &&
        (!this.arena() || String(c.arena) === this.arena()),
      )
      .sort((a, b) =>
        (a.turno ?? Number.MAX_SAFE_INTEGER) -
        (b.turno ?? Number.MAX_SAFE_INTEGER) ||
        a.numero - b.numero,
      );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');

    this.api.combates(this.torneoId).subscribe({
      next: data => {
        this.combates.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar los combates.');
      },
    });

    this.api.seleccionActual(this.torneoId).subscribe({
      next: data => {
        this.proyectadoId.set(data.combateId);
        if (!data.publico) {
          this.error.set(
            'El torneo está privado. Activa su visibilidad pública para abrir el versus sin sesión.',
          );
        }
      },
      error: () => this.error.set('No se pudo consultar la proyección actual.'),
    });
  }

  cambiarBloque(id: string): void {
    this.bloqueId.set(id);
    this.dojoId.set('');
    this.arena.set('');
  }

  cambiarDojo(id: string): void {
    this.dojoId.set(id);
    this.arena.set('');
  }

  mostrar(c: CombateVersus): void {
    this.guardar(c._id, `En pantalla: ${c.robot1?.nombre} VS ${c.robot2?.nombre}`);
  }

  quitar(): void {
    this.guardar(null, 'La pantalla pública está en espera.');
  }

  private guardar(id: string | null, mensaje: string): void {
    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');

    this.api.mostrar(this.torneoId, id).subscribe({
      next: () => {
        this.proyectadoId.set(id);
        this.mensaje.set(mensaje);
        this.guardando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cambiar la proyección. Revisa tus permisos.');
        this.guardando.set(false);
      },
    });
  }
}