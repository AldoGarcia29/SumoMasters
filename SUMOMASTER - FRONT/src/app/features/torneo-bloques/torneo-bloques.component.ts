import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { Torneo } from '../../core/models/torneo.model';
import { Bloque } from '../../core/models/bloque.model';

@Component({
  selector: 'app-torneo-bloques',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SidebarComponent,
    TopbarComponent,
    RobotChipComponent,
  ],
  templateUrl: './torneo-bloques.component.html',
  styleUrl: './torneo-bloques.component.scss',
})
export class TorneoBloquesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly torneoService = inject(TorneoService);
  private readonly bloqueService = inject(BloqueService);
  private readonly fb = inject(FormBuilder);

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
  readonly activeTab = signal<'vista' | 'lista'>('vista');

  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalRobots = computed(() =>
    this.bloques().reduce((acc, b) => acc + b.robots.length, 0),
  );

  readonly form = this.fb.nonNullable.group({
    tamanioBloque: [16],
    metodoDistribucion: this.fb.nonNullable.control<'aleatorio' | 'aleatorio-balanceado'>(
      'aleatorio-balanceado',
    ),
    balancearPorRanking: [true],
  });

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({
      next: (torneo) => {
        this.torneo.set(torneo);
        this.form.controls.tamanioBloque.setValue(torneo.tamanioBloque);
      },
    });
    this.loadBloques();
  }

  loadBloques(): void {
    this.loading.set(true);
    this.bloqueService.findByTorneo(this.torneoId).subscribe({
      next: (data) => {
        this.bloques.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'vista' | 'lista'): void {
    this.activeTab.set(tab);
  }

  generar(): void {
    const raw = this.form.getRawValue();
    this.generating.set(true);
    this.errorMessage.set(null);

    this.bloqueService
      .generar(this.torneoId, {
        tamanioBloque: raw.tamanioBloque,
        metodoDistribucion: raw.metodoDistribucion,
        balancearPorRanking: raw.balancearPorRanking,
      })
      .subscribe({
        next: (bloques) => {
          this.bloques.set(bloques);
          this.generating.set(false);
        },
        error: (err) => {
          this.generating.set(false);
          this.errorMessage.set(
            err?.error?.message ?? 'No se pudieron generar los bloques.',
          );
        },
      });
  }

  todosLosRobots(): { robot: Bloque['robots'][number]; bloqueNombre: string }[] {
    return this.bloques().flatMap((bloque) =>
      bloque.robots.map((robot) => ({ robot, bloqueNombre: bloque.nombre })),
    );
  }

  continuar(): void {
    this.router.navigate(['/torneos', this.torneoId, 'enfrentamientos']);
  }
}
