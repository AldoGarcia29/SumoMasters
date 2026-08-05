import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { CombateService } from '../../core/services/combate.service';
import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';
import { Combate, FaseCombate } from '../../core/models/combate.model';

@Component({
  selector: 'app-torneo-enfrentamientos',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent, RobotChipComponent],
  templateUrl: './torneo-enfrentamientos.component.html',
  styleUrl: './torneo-enfrentamientos.component.scss',
})
export class TorneoEnfrentamientosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly torneoService = inject(TorneoService);
  private readonly bloqueService = inject(BloqueService);
  private readonly combateService = inject(CombateService);

  readonly sidebarOpen = signal(false);
  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  readonly torneoId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly torneo = signal<Torneo | null>(null);
  readonly bloques = signal<Bloque[]>([]);
  readonly selectedBloqueId = signal<string>('');
  readonly combates = signal<Combate[]>([]);

  readonly fases = Object.values(FaseCombate);
  readonly activeFase = signal<FaseCombate>(FaseCombate.FASE_GRUPOS);

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });

    this.bloqueService.findByTorneo(this.torneoId).subscribe({
      next: (bloques) => {
        this.bloques.set(bloques);
        if (bloques.length > 0) {
          this.selectedBloqueId.set(bloques[0]._id);
          this.loadCombates();
        }
      },
    });
  }

  setFase(fase: FaseCombate): void {
    this.activeFase.set(fase);
    this.loadCombates();
  }

  onBloqueChange(bloqueId: string): void {
    this.selectedBloqueId.set(bloqueId);
    this.loadCombates();
  }

  loadCombates(): void {
    if (!this.selectedBloqueId()) return;

    this.loading.set(true);
    this.combateService
      .findByTorneo(this.torneoId, {
        bloque: this.selectedBloqueId(),
        fase: this.activeFase(),
      })
      .subscribe({
        next: (data) => {
          this.combates.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  generar(): void {
    this.generating.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.combateService
      .generar(this.torneoId, { fase: this.activeFase() })
      .subscribe({
        next: () => {
          this.generating.set(false);
          this.successMessage.set('Enfrentamientos generados correctamente.');
          this.loadCombates();
        },
        error: (err) => {
          this.generating.set(false);
          this.errorMessage.set(
            err?.error?.message ?? 'No se pudieron generar los enfrentamientos.',
          );
        },
      });
  }

  bloqueNombre(id: string): string {
    return this.bloques().find((b) => b._id === id)?.nombre ?? '';
  }

  continuar(): void {
    this.router.navigate(['/torneos', this.torneoId, 'dojos']);
  }
}
