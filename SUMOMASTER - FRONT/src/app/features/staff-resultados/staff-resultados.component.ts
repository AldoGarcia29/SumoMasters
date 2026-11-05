
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  AsignacionesStaffService,
  AsignacionStaff,
} from '../../core/services/asignaciones-staff.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/auth.model';
import { TorneoService } from '../../core/services/torneo.service';
import { Torneo } from '../../core/models/torneo.model';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

@Component({
  selector: 'app-staff-resultados',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  template: `
    <app-sidebar
      [isOpen]="sidebarOpen()"
      (closeRequested)="sidebarOpen.set(false)"
    />

    <div class="staff-content">
      <app-topbar
        title="Registro de resultados"
        (menuToggle)="sidebarOpen.set(!sidebarOpen())"
      />

      <main class="staff-main">
        <section class="staff-panel">
          <h1>Registro de resultados</h1>

          <p *ngIf="esStaff()">
            Selecciona tu dojo asignado para registrar resultados.
            Si tienes una sola asignación para hoy,
            se abrirá automáticamente.
          </p>

          <p *ngIf="!esStaff()">
            Selecciona un torneo para registrar los resultados
            de sus combates.
          </p>

          <p *ngIf="loading()">Cargando torneos...</p>

          <p *ngIf="error()" role="alert">
            {{ error() }}
          </p>

          <p
            *ngIf="
              !loading() &&
              !error() &&
              esStaff() &&
              !asignacionesVigentes().length &&
              !asignaciones().length
            "
          >
            No hay asignaciones vinculadas a tu cuenta.
            Pide al administrador que compruebe el usuario
            y el torneo.
          </p>

          <p
            *ngIf="
              !loading() &&
              !error() &&
              esStaff() &&
              !asignacionesVigentes().length &&
              asignaciones().length
            "
          >
            Tienes asignaciones registradas, pero ninguna
            corresponde a hoy. Consulta las fechas a continuación.
          </p>

          <div
            class="staff-list"
            *ngIf="esStaff() && !asignacionesVigentes().length"
          >
            <div
              *ngFor="let a of asignaciones()"
              class="staff-torneo"
            >
              <span>
                <strong>
                  {{ nombreTorneo(a.torneo) }} ·
                  {{ nombreDojo(a.dojo) }}
                </strong>

                <small>Asignado para {{ a.fecha }}</small>
              </span>

              <span>Otra fecha</span>
            </div>
          </div>

          <p
            *ngIf="
              !loading() &&
              !error() &&
              !esStaff() &&
              !torneos().length
            "
          >
            No hay torneos disponibles.
          </p>

          <div class="staff-list" *ngIf="esStaff()">
            <a
              *ngFor="let a of asignacionesVigentes()"
              class="staff-torneo"
              [routerLink]="[
                '/torneos',
                a.torneo,
                'resultados'
              ]"
              [queryParams]="{ dojo: a.dojo }"
            >
              <span>
                <strong>
                  {{ nombreTorneo(a.torneo) }} ·
                  {{ nombreDojo(a.dojo) }}
                </strong>

                <small>Fecha: {{ a.fecha }}</small>
              </span>

              <span>Ver mis combates →</span>
            </a>
          </div>

          <div class="staff-list" *ngIf="!esStaff()">
            <a
              *ngFor="let torneo of torneos()"
              class="staff-torneo"
              [routerLink]="[
                '/torneos',
                torneo._id,
                'resultados'
              ]"
            >
              <span>
                <strong>{{ torneo.nombre }}</strong>
                <small>{{ torneo.estado }}</small>
              </span>

              <span>Registrar resultados →</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: #071324;
        color: #eff8ff;
      }

      :host,
      .staff-content {
        position: relative;
      }

      .staff-content {
        margin-left: 260px;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
      }

      .staff-content app-topbar {
        display: block;
        flex: none;
      }

      .staff-main {
        width: 100%;
        max-width: 1320px;
        margin: 0 auto;
        flex: 1;
        padding: clamp(20px, 3vw, 46px);
        box-sizing: border-box;
        background:
          radial-gradient(
            ellipse at 80% 0%,
            rgba(0, 208, 255, .14),
            transparent 55%
          ),
          linear-gradient(180deg, #091a30, #071324);
      }

      .staff-panel {
        background: linear-gradient(145deg, #102946, #091a30);
        border: 1px solid #275578;
        border-radius: 24px;
        padding: clamp(22px, 3.5vw, 44px);
        box-shadow: 0 24px 70px rgba(0, 4, 15, .3);
      }

      h1 {
        margin: 0 0 12px;
        color: #f7fcff;
        font-size: clamp(1.8rem, 3.2vw, 3rem);
        font-weight: 850;
        line-height: 1.12;
        letter-spacing: -.035em;
      }

      p {
        color: #c8dbee;
        font-size: clamp(1rem, 1.35vw, 1.15rem);
        line-height: 1.6;
        max-width: 72ch;
      }

      p[role=alert] {
        border: 1px solid #ff7286;
        background: #582437;
        color: #ffe8ed;
        border-radius: 12px;
        padding: 14px 18px;
      }

      .staff-list {
        display: grid;
        gap: 16px;
        margin-top: 30px;
      }

      .staff-torneo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 24px;
        border: 1px solid #306487;
        border-radius: 18px;
        color: #041a2b;
        text-decoration: none;
        background: #123454;
        transition:
          border-color .2s,
          transform .2s,
          box-shadow .2s;
      }

      a.staff-torneo:hover {
        border-color: #36dfff;
        transform: translateY(-2px);
        box-shadow: 0 12px 35px rgba(0, 195, 255, .12);
      }

      a.staff-torneo:focus-visible {
        outline: 3px solid #ffcc44;
        outline-offset: 4px;
      }

      .staff-torneo strong {
        display: block;
        color: #f7fbff;
        font-size: clamp(1.18rem, 1.65vw, 1.55rem);
        line-height: 1.35;
      }

      .staff-torneo small {
        display: block;
        color: #bdd6e8;
        font-size: 1rem;
        margin-top: 8px;
      }

      .staff-torneo span {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .staff-torneo span:last-child {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 13px 20px;
        border-radius: 12px;
        background: #15d3f5;
        color: #04192a;
        font-size: 1rem;
        font-weight: 850;
        text-align: center;
      }

      div.staff-torneo span:last-child {
        background: #243e55;
        color: #d5e7f5;
      }

      @media (max-width: 900px) {
        .staff-content {
          margin-left: 0;
        }

        .staff-main {
          padding: 20px;
        }
      }

      @media (max-width: 600px) {
        .staff-main {
          padding: 12px;
        }

        .staff-panel {
          padding: 23px 16px;
          border-radius: 17px;
        }

        .staff-torneo {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
          padding: 18px;
        }

        .staff-torneo span:last-child {
          width: 100%;
        }
      }
    `,
  ],
})
export class StaffResultadosComponent implements OnInit {
  private readonly torneosService = inject(TorneoService);
  private readonly asignacionesService = inject(AsignacionesStaffService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly esStaff = () =>
    this.auth.hasAnyRole([Role.STAFF]) &&
    !this.auth.hasAnyRole([Role.ADMIN]);

  readonly asignaciones = signal<AsignacionStaff[]>([]);
  readonly dojos = signal<{ _id: string; nombre: string }[]>([]);

  readonly asignacionesVigentes = () => {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    return this.asignaciones().filter(
      (a) => a.fecha === hoy,
    );
  };

  nombreTorneo(id: string): string {
    return (
      this.torneos().find((t) => t._id === id)?.nombre ??
      'Torneo'
    );
  }

  nombreDojo(id: string): string {
    return (
      this.dojos().find((d) => d._id === id)?.nombre ??
      'Dojo asignado'
    );
  }

  readonly sidebarOpen = signal(false);
  readonly torneos = signal<Torneo[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    if (!this.esStaff()) {
      this.torneosService.findAll().subscribe({
        next: (torneos) => {
          this.torneos.set(torneos);
          this.loading.set(false);
        },

        error: () => {
          this.error.set(
            'No se pudieron cargar los torneos.',
          );
          this.loading.set(false);
        },
      });

      return;
    }

    forkJoin({
      asignaciones: this.asignacionesService.mias(),
      torneos: this.torneosService.findAll(),
    }).subscribe({
      next: ({ asignaciones, torneos }) => {
        this.asignaciones.set(asignaciones);
        this.torneos.set(torneos);
        this.loading.set(false);

        const vigentes = this.asignacionesVigentes();

        if (vigentes.length === 1) {
          const a = vigentes[0];

          this.router.navigate(
            ['/torneos', a.torneo, 'resultados'],
            {
              queryParams: { dojo: a.dojo },
            },
          );
        }
      },

      error: () => {
        this.error.set(
          'No se pudieron cargar tus asignaciones de dojo.',
        );
        this.loading.set(false);
      },
    });
  }
}