import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Torneo } from '../../core/models/torneo.model';
import { TorneoService } from '../../core/services/torneo.service';
import { VersusService } from '../../core/services/versus.service';

@Component({
  selector: 'app-control-pantallas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="pantallas">
      <header>
        <a routerLink="/staff/resultados">← Volver</a>
        <span class="eyebrow">PRODUCCIÓN EN VIVO</span>
        <h1>Control de pantallas</h1>
        <p>Configura las pantallas del evento y comparte sus enlaces.</p>
      </header>

      <p class="mensaje mensaje--error" role="alert" *ngIf="error()">{{ error() }}</p>
      <p class="mensaje" role="status" *ngIf="mensaje()">{{ mensaje() }}</p>

      <section class="configuracion">
        <label>
          Torneo
          <select [ngModel]="torneoId()" (ngModelChange)="seleccionarTorneo($event)">
            <option value="" disabled>Selecciona un torneo</option>
            <option *ngFor="let torneo of torneos()" [value]="torneo._id">{{ torneo.nombre }}</option>
          </select>
        </label>

        <label>
          Dojos activos
          <span class="stepper">
            <button type="button" aria-label="Reducir dojos activos" (click)="ajustarDojos(-1)" [disabled]="dojosActivos() <= 1 || guardando()">−</button>
            <strong>{{ dojosActivos() }}</strong>
            <button type="button" aria-label="Aumentar dojos activos" (click)="ajustarDojos(1)" [disabled]="dojosActivos() >= dojosDisponibles() || guardando()">+</button>
          </span>
          <small>Máximo disponible: {{ dojosDisponibles() }}</small>
        </label>
      </section>

      <section class="tarjetas" *ngIf="torneoId()">
        <article *ngFor="let pantalla of pantallas">
          <div class="icono">{{ pantalla.icono }}</div>
          <h2>{{ pantalla.titulo }}</h2>
          <p>{{ pantalla.descripcion }}</p>
          <code>{{ url(pantalla.path) }}</code>
          <div class="acciones">
            <a [href]="url(pantalla.path)" target="_blank" rel="noopener">Abrir ↗</a>
            <button type="button" (click)="copiar(pantalla.path)">Copiar enlace</button>
          </div>
        </article>
      </section>

      <p class="vacio" *ngIf="!torneos().length && !cargando()">No hay torneos disponibles.</p>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; color: #f5f2ff; background: #0b0915; }
    * { box-sizing: border-box; }
    .pantallas { width: min(1180px, 100%); margin: auto; padding: clamp(20px, 4vw, 52px); }
    header { margin-bottom: 28px; }
    header a { color: #c9aaff; text-decoration: none; }
    .eyebrow { display: block; margin-top: 24px; color: #b08cff; font-size: 12px; font-weight: 800; letter-spacing: 3px; }
    h1 { margin: 8px 0; font-size: clamp(30px, 4vw, 48px); }
    header p, article p, small { color: #b9b2c8; }
    .configuracion { display: grid; grid-template-columns: minmax(220px, 2fr) minmax(180px, 1fr); align-items: end; gap: 20px; padding: 22px; border: 1px solid #ffffff18; border-radius: 18px; background: #ffffff08; }
    label { display: grid; gap: 10px; font-weight: 700; }
    select { min-height: 48px; padding: 10px 14px; border: 1px solid #675486; border-radius: 10px; color: inherit; background: #1c1728; font: inherit; }
    .stepper { display: flex; align-items: center; gap: 20px; }
    .stepper button { width: 48px; height: 48px; border: 1px solid #7655a4; border-radius: 12px; color: #fff; background: #241b35; font-size: 24px; cursor: pointer; }
    .stepper strong { min-width: 24px; text-align: center; font-size: 22px; }
    .tarjetas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
    article { display: flex; min-width: 0; flex-direction: column; padding: 22px; border: 1px solid #ffffff1c; border-radius: 18px; background: linear-gradient(155deg, #19152a, #100e1a); box-shadow: 0 16px 44px #0004; }
    .icono { font-size: 27px; }
    h2 { margin: 15px 0 6px; font-size: 20px; }
    article p { min-height: 44px; margin: 0 0 18px; line-height: 1.5; }
    code { overflow-wrap: anywhere; color: #d7c3ff; font-size: 12px; }
    .acciones { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; padding-top: 22px; }
    .acciones a, .acciones button { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border: 1px solid #7854b6; border-radius: 10px; color: #fff; background: #6838a8; font: inherit; text-decoration: none; cursor: pointer; }
    .acciones button { background: transparent; }
    .mensaje, .vacio { margin-top: 18px; padding: 14px; border-radius: 10px; background: #2a2038; }
    .mensaje--error { color: #ffb6c1; background: #391924; }
    @media (max-width: 800px) { .tarjetas { grid-template-columns: 1fr; } article p { min-height: 0; } }
    @media (max-width: 520px) { .pantallas { padding: 18px; } .configuracion { grid-template-columns: 1fr; } }
  `],
})
export class ControlPantallasComponent implements OnInit {
  private readonly torneosApi = inject(TorneoService);
  private readonly api = inject(VersusService);
  private readonly storageKey = 'sumomasters.ultimoTorneoPantallas';
  private solicitud = 0;

  readonly torneos = signal<Torneo[]>([]);
  readonly torneoId = signal('');
  readonly dojosActivos = signal(1);
  readonly dojosDisponibles = signal(1);
  readonly guardando = signal(false);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly pantallas = [
    {
      titulo: 'Pantalla principal',
      descripcion: 'El combate destacado para el proyector principal.',
      icono: '⚔️',
      path: '/versus/principal',
    },
    {
      titulo: 'Programa de combates',
      descripcion: 'El lote actual y la cola de enfrentamientos.',
      icono: '📋',
      path: '/live/{id}/combates',
    },
    {
      titulo: 'Control desde celular',
      descripcion: 'Prioriza un combate y administra los dojos activos.',
      icono: '📱',
      path: '/torneos/{id}/control-versus',
    },
  ];

  ngOnInit(): void {
    this.torneosApi.findAll().subscribe({
      next: (torneos) => {
        this.torneos.set(torneos);
        this.cargando.set(false);
        const guardado = localStorage.getItem(this.storageKey);
        const inicial =
          torneos.find((torneo) => torneo._id === guardado)?._id ??
          torneos[0]?._id ??
          '';
        if (inicial) this.seleccionarTorneo(inicial);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar los torneos.');
      },
    });
  }

  seleccionarTorneo(id: string): void {
    if (!id) return;
    const solicitud = ++this.solicitud;
    this.torneoId.set(id);
    this.dojosActivos.set(1);
    this.dojosDisponibles.set(1);
    this.mensaje.set('');
    this.error.set('');
    localStorage.setItem(this.storageKey, id);
    this.api.pantallas(id).subscribe({
      next: (pantallas) => {
        if (solicitud !== this.solicitud) return;
        this.dojosDisponibles.set(Math.max(1, pantallas.dojosDisponibles));
        this.dojosActivos.set(pantallas.dojosActivos);
      },
      error: () => {
        if (solicitud === this.solicitud) {
          this.error.set('No se pudo cargar la configuración de pantallas.');
        }
      },
    });
  }

  ajustarDojos(delta: number): void {
    const valor = Math.min(this.dojosDisponibles(), Math.max(1, this.dojosActivos() + delta));
    if (valor === this.dojosActivos() || this.guardando()) return;
    const anterior = this.dojosActivos();
    this.dojosActivos.set(valor);
    this.guardando.set(true);
    this.api.actualizarPantallas(this.torneoId(), { dojosActivos: valor }).subscribe({
      next: (respuesta) => {
        this.dojosActivos.set(respuesta.dojosActivos);
        this.guardando.set(false);
      },
      error: () => {
        this.dojosActivos.set(anterior);
        this.guardando.set(false);
        this.error.set('No se pudo guardar la cantidad de dojos activos.');
      },
    });
  }

  url(path: string): string {
    return `${window.location.origin}${path.replace('{id}', this.torneoId())}${
      path === '/versus/principal' ? `?torneo=${this.torneoId()}` : ''
    }`;
  }

  async copiar(path: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url(path));
      this.mensaje.set('Enlace copiado al portapapeles.');
    } catch {
      this.error.set('No se pudo copiar el enlace. Puedes copiarlo desde la tarjeta.');
    }
  }
}
