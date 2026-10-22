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
import { FaseCombate } from '../../core/models/combate.model';
import { LugarPodio, PodioTorneo } from '../../core/models/podio.model';
import { extractErrorMessage } from '../../core/utils/error-message.util';
import { RobotFichaDialogService } from '../../core/services/robot-ficha-dialog.service';

@Component({
  selector: 'app-torneo-podio',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
  ],
  templateUrl: './torneo-podio.component.html',
  styleUrl: './torneo-podio.component.scss',
})
export class TorneoPodioComponent implements OnInit {
  private readonly route =
    inject(ActivatedRoute);

  private readonly torneoService =
    inject(TorneoService);

  private readonly rankingService =
    inject(RankingService);

  private readonly fichaDialog =
    inject(RobotFichaDialogService);

  readonly torneoId =
    this.route.snapshot.paramMap.get('id') ?? '';

  readonly torneo =
    signal<Torneo | null>(null);

  readonly podio =
    signal<PodioTorneo | null>(null);

  readonly loading = signal(false);

  readonly errorMessage =
    signal<string | null>(null);

  readonly sidebarOpen = signal(false);

  readonly FaseCombate = FaseCombate;

  ngOnInit(): void {
    if (!this.torneoId) {
      this.errorMessage.set(
        'No se encontró el identificador del torneo.',
      );

      return;
    }

    this.loadTorneo();
    this.loadPodio();
  }

  private loadTorneo(): void {
    this.torneoService
      .findOne(this.torneoId)
      .subscribe({
        next: (torneo) => {
          this.torneo.set(torneo);
        },
        error: (err) => {
          console.error(
            'No se pudo cargar el torneo:',
            err,
          );
        },
      });
  }

  loadPodio(): void {
    if (!this.torneoId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.rankingService
      .obtenerPodio(this.torneoId)
      .subscribe({
        next: (podio) => {
          this.podio.set(podio);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.podio.set(null);

          this.errorMessage.set(
            extractErrorMessage(
              err,
              'No se pudieron cargar los resultados finales del torneo.',
            ),
          );
        },
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(
      (value) => !value,
    );
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  etiquetaRobot(lugar: LugarPodio): string {
    const numero = this.numeroRobot(lugar.robotId);
    return numero === undefined
      ? lugar.robotNombre
      : `#${String(numero).padStart(3, '0')} ${lugar.robotNombre}`;
  }

  abrirFicha(lugar: LugarPodio): void {
    this.fichaDialog.open({
      torneoId: this.torneoId,
      robotId: lugar.robotId,
      numero: this.numeroRobot(lugar.robotId) ?? null,
      publico: false,
    });
  }

  private numeroRobot(robotId: string): number | undefined {
    return this.torneo()?.participantes?.find((item) =>
      typeof item.robot === 'string'
        ? item.robot === robotId
        : item.robot._id === robotId,
    )?.numero;
  }
}