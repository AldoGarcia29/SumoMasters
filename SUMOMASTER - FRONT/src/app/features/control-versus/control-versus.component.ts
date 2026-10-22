import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import {
  VersusService,
  CombateVersus,
} from '../../core/services/versus.service';
import { TorneoService } from '../../core/services/torneo.service';
import { Torneo } from '../../core/models/torneo.model';
import { FaseCombate } from '../../core/models/combate.model';

@Component({
  selector: 'app-control-versus',
  standalone: true,
  imports: [CommonModule, RouterLink],

  template: `
    <main class="control">
      <header>
        <div>
          <a [routerLink]="['/torneos']">
            ← Volver a torneos
          </a>

          <h1>Control de pantalla pública</h1>

          <p>
            Elige torneo, fase y ronda para presentar un combate.
          </p>
        </div>

        <a
          *ngIf="torneoId()"
          class="btn"
          [routerLink]="['/versus', torneoId()]"
          target="_blank"
          rel="noopener"
        >
          Abrir pantalla pública ↗
        </a>
      </header>

      <p class="error" role="alert" *ngIf="error()">
        {{ error() }}
      </p>

      <p class="aviso" role="status" *ngIf="aviso()">
        {{ aviso() }}
      </p>

      <p class="ok" role="status" *ngIf="mensaje()">
        {{ mensaje() }}
      </p>

      <section class="filtros">
        <label>
          Torneo

          <select
            [value]="torneoId()"
            [disabled]="cargandoTorneos() || guardando()"
            (change)="cambiarTorneo($any($event.target).value)"
          >
            <option value="" disabled>
              Selecciona un torneo
            </option>

            <option
              *ngFor="let torneo of torneos()"
              [value]="torneo._id"
            >
              {{ torneo.nombre }}
            </option>
          </select>
        </label>

        <label>
          Fase

          <select
            [value]="fase()"
            [disabled]="cargando() || guardando() || !fases().length"
            (change)="cambiarFase($any($event.target).value)"
          >
            <option value="" *ngIf="!fases().length">
              Sin fases generadas
            </option>

            <option
              *ngFor="let opcion of fases()"
              [value]="opcion"
            >
              {{ opcion }}
            </option>
          </select>
        </label>

        <label *ngIf="esGrupos()">
          Ronda

          <select
            [value]="ronda()"
            [disabled]="cargando() || guardando()"
            (change)="ronda.set($any($event.target).value)"
          >
            <option value="">Todas las rondas</option>

            <option
              *ngFor="let numero of rondas()"
              [value]="numero"
            >
              {{
                numero > 0
                  ? 'Ronda ' + numero
                  : 'Sin ronda registrada'
              }}
            </option>
          </select>
        </label>
      </section>

      <section class="lista">
        <div class="titulo">
          <div>
            <span class="etiqueta">{{ torneoNombre() }}</span>

            <h2>{{ fase() || 'Combates disponibles' }}</h2>

            <p class="resumen">
              {{ filtrados().length }} combates
              <ng-container *ngIf="esGrupos() && ronda()">
                ·
                {{
                  ronda() === '0'
                    ? 'Sin ronda registrada'
                    : 'Ronda ' + ronda()
                }}
              </ng-container>
            </p>
          </div>

          <button
            type="button"
            class="secundario"
            (click)="cargar()"
            [disabled]="cargando() || guardando() || !torneoId()"
          >
            {{ cargando() ? 'Cargando…' : 'Actualizar lista' }}
          </button>
        </div>

        <p class="vacio" *ngIf="cargando()">
          Cargando combates…
        </p>

        <p
          class="vacio"
          *ngIf="!cargando() && !filtrados().length"
        >
          No hay combates registrados para esta selección.
        </p>

        <ng-container *ngIf="!cargando()">
          <article
            *ngFor="let c of filtrados(); trackBy: identificarCombate"
            [class.activo]="proyectadoId() === c._id"
          >
            <div class="combate-info">
              <div class="datos">
                <span class="badge" *ngIf="esGrupos()">
                  {{
                    c.ronda
                      ? 'Ronda ' + c.ronda
                      : 'Sin ronda'
                  }}
                </span>

                <span class="badge" *ngIf="c.bloque">
                  {{ c.bloque.nombre }}
                </span>

                <span class="horario">
                  {{ horario(c) }}
                </span>
              </div>

              <h3>
                <small>#{{ c.numero }}</small>
                {{ c.robot1?.nombre || 'Por definir' }}
                <span class="vs">VS</span>
                {{ c.robot2?.nombre || 'Por definir' }}
              </h3>

              <p class="ubicacion">
                {{ c.dojo?.nombre || 'Dojo por asignar' }}

                <ng-container *ngIf="c.arena != null">
                  · Arena {{ c.arena }}
                </ng-container>
              </p>

              <small class="estado">
                {{ c.estado }}
                <strong *ngIf="proyectadoId() === c._id">
                  · EN PANTALLA
                </strong>
              </small>
            </div>

            <button
              type="button"
              class="btn"
              (click)="mostrar(c)"
              [disabled]="
                guardando() ||
                !seleccionDisponible() ||
                !c.robot1 ||
                !c.robot2
              "
            >
              {{
                proyectadoId() === c._id
                  ? 'Volver a mostrar'
                  : 'Mostrar al público'
              }}
            </button>
          </article>
        </ng-container>

        <div class="acciones">
          <button
            type="button"
            class="secundario"
            (click)="quitar()"
            [disabled]="
              cargando() ||
              guardando() ||
              !seleccionDisponible() ||
              !proyectadoId()
            "
          >
            Dejar pantalla en espera
          </button>

          <span *ngIf="guardando()">Actualizando pantalla…</span>
        </div>
      </section>
    </main>
  `,

  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      color: #24163d;
      background: #f5f2fc;
      font-family: 'Segoe UI', Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .control {
      max-width: 1280px;
      margin: auto;
      padding: 32px;
    }

    header,
    .titulo,
    article {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    header {
      margin-bottom: 28px;
    }

    h1 {
      margin: 20px 0 8px;
      font-size: clamp(24px, 3vw, 34px);
    }

    header p,
    .resumen,
    .ubicacion {
      color: #776b89;
      line-height: 1.6;
    }

    a {
      color: #7233df;
    }

    .filtros,
    .lista {
      margin-top: 24px;
      padding: 24px;
      background: #fff;
      border: 1px solid #e7ddfa;
      border-radius: 18px;
    }

    .filtros {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
    }

    label {
      display: grid;
      gap: 10px;
      min-width: 0;
      font-weight: 600;
    }

    select {
      width: 100%;
      min-width: 0;
      min-height: 46px;
      padding: 12px;
      color: #24163d;
      background: #f8f5ff;
      border: 1px solid #ded2f7;
      border-radius: 10px;
      font: inherit;
    }

    select:focus-visible,
    button:focus-visible,
    a:focus-visible {
      outline: 3px solid #b99ae9;
      outline-offset: 3px;
    }

    h2 {
      margin: 8px 0;
      font-size: 23px;
    }

    .etiqueta {
      color: #7835e5;
      font-size: 13px;
      font-weight: 700;
    }

    .resumen {
      margin: 0;
      font-size: 14px;
    }

    article {
      margin: 16px 0;
      padding: 20px;
      border: 1px solid #e8e0f5;
      border-radius: 14px;
    }

    article.activo {
      background: #f5efff;
      border-color: #7c3aed;
      box-shadow: inset 0 0 0 1px #7c3aed;
    }

    .combate-info {
      min-width: 0;
    }

    .datos {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .badge {
      padding: 5px 9px;
      color: #7541b9;
      background: #f1e9ff;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 600;
    }

    .horario {
      color: #5e5074;
      font-size: 13px;
      font-weight: 600;
    }

    h3 {
      margin: 14px 0 8px;
      font-size: 19px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    h3 small {
      margin-right: 8px;
      color: #776b89;
      font-size: 13px;
    }

    .vs {
      margin: 0 10px;
      color: #8b5cf6;
      font-size: 14px;
      font-weight: 800;
    }

    .ubicacion {
      margin: 0 0 8px;
      font-size: 13px;
    }

    .estado {
      color: #776b89;
    }

    .estado strong {
      color: #7835e5;
    }

    button,
    .btn {
      padding: 12px 18px;
      border: 0;
      border-radius: 10px;
      font: inherit;
      cursor: pointer;
    }

    .btn {
      flex-shrink: 0;
      color: #fff;
      background: #7835e5;
      text-align: center;
      text-decoration: none;
    }

    .secundario {
      color: #53248d;
      background: #eee7fa;
    }

    button:disabled,
    select:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error,
    .ok,
    .aviso {
      padding: 16px;
      border-radius: 10px;
      line-height: 1.6;
    }

    .error {
      color: #991b1b;
      background: #fee2e2;
    }

    .ok {
      color: #166534;
      background: #dcfce7;
    }

    .aviso {
      color: #854d0e;
      background: #fef3c7;
    }

    .vacio {
      padding: 28px 0;
      color: #776b89;
      text-align: center;
    }

    .acciones {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid #eee7f7;
    }

    .acciones span {
      color: #776b89;
      font-size: 13px;
    }

    @media (max-width: 700px) {
      .control {
        padding: 18px;
      }

      header,
      article,
      .titulo {
        align-items: stretch;
        flex-direction: column;
        gap: 16px;
      }

      .filtros {
        grid-template-columns: minmax(0, 1fr);
      }

      .filtros,
      .lista {
        padding: 18px;
      }

      article {
        padding: 16px;
      }

      .acciones > button {
        width: 100%;
      }
    }
  `],
})
export class ControlVersusComponent implements OnInit {
  private readonly api = inject(VersusService);
  private readonly torneoService = inject(TorneoService);
  private readonly route = inject(ActivatedRoute);

  private solicitud = 0;

  readonly torneoId = signal('');
  readonly torneos = signal<Torneo[]>([]);
  readonly combates = signal<CombateVersus[]>([]);

  readonly fase = signal('');
  readonly ronda = signal('');

  readonly proyectadoId = signal<string | null>(null);
  readonly seleccionDisponible = signal(false);

  readonly cargandoTorneos = signal(false);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  readonly error = signal('');
  readonly aviso = signal('');
  readonly mensaje = signal('');

  readonly esGrupos = computed(
    () => this.fase() === FaseCombate.FASE_GRUPOS,
  );

  readonly torneoNombre = computed(
    () =>
      this.torneos().find(
        (torneo) => torneo._id === this.torneoId(),
      )?.nombre ?? 'Torneo',
  );

  readonly fases = computed(() => {
    const disponibles = new Set(
      this.combates().map((combate) => combate.fase),
    );

    const conocidas: string[] = Object.values(FaseCombate);

    return [
      ...conocidas.filter((fase) => disponibles.has(fase)),
      ...[...disponibles].filter(
        (fase) => !conocidas.includes(fase),
      ),
    ];
  });

  readonly rondas = computed(() =>
    [
      ...new Set(
        this.combates()
          .filter(
            (combate) =>
              combate.fase === FaseCombate.FASE_GRUPOS,
          )
          .map((combate) => combate.ronda ?? 0),
      ),
    ].sort((a, b) => a - b),
  );

  readonly filtrados = computed(() =>
    this.combates()
      .filter((combate) => {
        if (combate.fase !== this.fase()) return false;

        return (
          !this.esGrupos() ||
          !this.ronda() ||
          String(combate.ronda ?? 0) === this.ronda()
        );
      })
      .sort((a, b) => {
        const porRonda = this.esGrupos()
          ? (a.ronda ?? 0) - (b.ronda ?? 0)
          : 0;

        if (porRonda !== 0) return porRonda;

        if (this.esGrupos()) {
          const bloqueA = a.bloque?.nombre ?? '';
          const bloqueB = b.bloque?.nombre ?? '';

          const porBloque =
            bloqueA.length - bloqueB.length ||
            bloqueA.localeCompare(bloqueB, 'es', {
              numeric: true,
            });

          if (porBloque !== 0) return porBloque;
        }

        return a.numero - b.numero;
      }),
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';

    this.torneoId.set(id);

    if (id) {
      this.cargar();
    }

    this.cargandoTorneos.set(true);

    this.torneoService.findAll().subscribe({
      next: (torneos) => {
        this.torneos.set(torneos);
        this.cargandoTorneos.set(false);

        if (!this.torneoId() && torneos.length > 0) {
          this.cambiarTorneo(torneos[0]._id);
        }
      },
      error: () => {
        this.cargandoTorneos.set(false);
        this.error.set(
          'No se pudo cargar la lista de torneos. Recarga la página.',
        );
      },
    });
  }

  cambiarTorneo(id: string): void {
    if (
      !id ||
      id === this.torneoId() ||
      this.guardando()
    ) {
      return;
    }

    this.torneoId.set(id);
    this.combates.set([]);
    this.fase.set('');
    this.ronda.set('');
    this.proyectadoId.set(null);
    this.mensaje.set('');

    this.cargar();
  }

  cambiarFase(fase: string): void {
    this.fase.set(fase);

    this.ronda.set(
      fase === FaseCombate.FASE_GRUPOS &&
      this.rondas().length > 0
        ? String(this.rondas()[0])
        : '',
    );
  }

  cargar(): void {
    const torneoId = this.torneoId();

    if (!torneoId || this.guardando()) return;

    const solicitud = ++this.solicitud;

    this.cargando.set(true);
    this.seleccionDisponible.set(false);
    this.proyectadoId.set(null);
    this.error.set('');
    this.aviso.set('');
    this.mensaje.set('');

    forkJoin({
      combates: this.api.combates(torneoId),
      seleccion: this.api.seleccionActual(torneoId).pipe(
        catchError(() => of(null)),
      ),
    }).subscribe({
      next: ({ combates, seleccion }) => {
        if (solicitud !== this.solicitud) return;

        this.combates.set(combates);

        if (!this.fases().includes(this.fase())) {
          this.cambiarFase(this.fases()[0] ?? '');
        } else if (
          this.esGrupos() &&
          this.ronda() &&
          !this.rondas().some(
            (numero) => String(numero) === this.ronda(),
          )
        ) {
          this.ronda.set(
            this.rondas().length
              ? String(this.rondas()[0])
              : '',
          );
        }

        if (seleccion) {
          this.seleccionDisponible.set(true);
          this.proyectadoId.set(seleccion.combateId);

          if (!seleccion.publico) {
            this.aviso.set(
              'Este torneo está privado. Activa su visibilidad pública para que el público pueda abrir el versus sin sesión.',
            );
          }
        } else {
          this.error.set(
            'Se cargaron los combates, pero no se pudo consultar la proyección. Pulsa Actualizar lista para reintentar.',
          );
        }

        this.cargando.set(false);
      },
      error: () => {
        if (solicitud !== this.solicitud) return;

        this.combates.set([]);
        this.cargando.set(false);
        this.error.set('No se pudieron cargar los combates.');
      },
    });
  }

  horario(combate: CombateVersus): string {
    if (!combate.horarioProgramado) {
      return 'Horario por definir';
    }

    const fecha = new Date(combate.horarioProgramado);

    if (!Number.isFinite(fecha.getTime())) {
      return 'Horario por definir';
    }

    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(fecha);
  }

  identificarCombate(
    _index: number,
    combate: CombateVersus,
  ): string {
    return combate._id;
  }

  mostrar(combate: CombateVersus): void {
    if (
      !combate.robot1 ||
      !combate.robot2 ||
      !this.filtrados().some(
        (item) => item._id === combate._id,
      )
    ) {
      return;
    }

    this.guardar(
      combate._id,
      `En pantalla: ${combate.robot1.nombre} VS ${combate.robot2.nombre}`,
    );
  }

  quitar(): void {
    this.guardar(null, 'La pantalla pública está en espera.');
  }

  private guardar(
    combateId: string | null,
    mensaje: string,
  ): void {
    const torneoId = this.torneoId();

    if (
      !torneoId ||
      this.guardando() ||
      this.cargando() ||
      !this.seleccionDisponible()
    ) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');

    this.api.mostrar(torneoId, combateId).subscribe({
      next: () => {
        this.proyectadoId.set(combateId);
        this.mensaje.set(mensaje);
        this.guardando.set(false);
      },
      error: () => {
        this.error.set(
          'No se pudo cambiar la proyección. Revisa tu conexión y tus permisos.',
        );
        this.guardando.set(false);
      },
    });
  }
}