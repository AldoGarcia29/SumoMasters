import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoService } from '../../core/services/torneo.service';
import { RankingService } from '../../core/services/ranking.service';
import { Torneo } from '../../core/models/torneo.model';
import {
  ResumenClasificados,
} from '../../core/models/clasificados.model';
import { extractErrorMessage } from '../../core/utils/error-message.util';

@Component({
  selector: 'app-torneo-clasificados',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl:
    './torneo-clasificados.component.html',
  styleUrl:
    './torneo-clasificados.component.scss',
})
export class TorneoClasificadosComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly torneoService =
    inject(TorneoService);

  private readonly rankingService =
    inject(RankingService);

  readonly torneoId =
    this.route.snapshot.paramMap.get('id') ??
    '';

  readonly torneo =
    signal<Torneo | null>(null);

  readonly resumen =
    signal<ResumenClasificados | null>(
      null,
    );

  readonly sidebarOpen = signal(false);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly faseGenerada = signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

  ngOnInit(): void {
    this.torneoService
      .findOne(this.torneoId)
      .subscribe({
        next: (torneo) =>
          this.torneo.set(torneo),
      });

    this.loadClasificados();
  }

  loadClasificados(): void {
  this.loading.set(true);
  this.errorMessage.set(null);

  this.rankingService
    .obtenerClasificados(this.torneoId)
    .subscribe({
      next: (respuesta) => {
        console.log('Clasificados recibidos:', respuesta);

        this.resumen.set({
          ...respuesta,

          bloques: (respuesta.bloques ?? []).map((bloque) => ({
            ...bloque,
            clasificados: bloque.clasificados ?? [],
          })),

          clasificados:
            respuesta.clasificados ?? [],

          pasesDirectos:
            respuesta.pasesDirectos ?? [],

          rondaPreliminar:
            respuesta.rondaPreliminar ?? [],

          totalBloques:
            respuesta.totalBloques ??
            respuesta.bloques?.length ??
            0,

          clasificadosPorBloque:
            respuesta.clasificadosPorBloque ?? 4,

          totalClasificados:
            respuesta.totalClasificados ??
            respuesta.clasificados?.length ??
            0,

          totalPasesDirectos:
            respuesta.totalPasesDirectos ??
            respuesta.pasesDirectos?.length ??
            0,
        });

        this.loading.set(false);
      },

      error: (err) => {
        console.error(
          'Error obteniendo clasificados:',
          err,
        );

        this.loading.set(false);

        this.errorMessage.set(
          extractErrorMessage(
            err,
            'No se pudieron cargar los clasificados.',
          ),
        );
      },
    });
}

  generarFaseEliminatoria(): void {
    const resumen = this.resumen();

    if (
      !resumen ||
      resumen.rondaPreliminar.length === 0
    ) {
      return;
    }

    const confirmado = window.confirm(
      `Se crearán ${resumen.rondaPreliminar.length} combates preliminares. ¿Deseas continuar?`,
    );

    if (!confirmado) return;

    this.generating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.rankingService
      .generarFaseEliminatoria(
        this.torneoId,
      )
      .subscribe({
        next: (respuesta) => {
          this.generating.set(false);
          this.faseGenerada.set(true);
          this.resumen.set(respuesta);

          this.successMessage.set(
            `${respuesta.combatesGenerados.length} combates preliminares fueron generados correctamente.`,
          );
        },
        error: (err) => {
          this.generating.set(false);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudo generar la fase eliminatoria.',
            ),
          );
        },
      });
  }

  porcentaje(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(
      (value) => !value,
    );
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
  puedeGenerar(): boolean {
  const datos = this.resumen();

  return (
    !this.loading() &&
    !this.generating() &&
    datos !== null &&
    (datos.rondaPreliminar?.length ?? 0) > 0 &&
    !this.faseGenerada()
  );
}
}