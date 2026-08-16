import { extractErrorMessage } from '../../core/utils/error-message.util';
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { RobotChipComponent } from '../../shared/components/robot-chip/robot-chip.component';
import { TorneoService } from '../../core/services/torneo.service';
import { BloqueService } from '../../core/services/bloque.service';
import { CombateService } from '../../core/services/combate.service';
import { TorneoFlowCacheService } from '../../core/services/torneo-flow-cache.service';
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
  private readonly flowCache = inject(TorneoFlowCacheService);

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
  readonly loadingBloques = signal(false);
  readonly generating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.torneoService.findOne(this.torneoId).subscribe({ next: (t) => this.torneo.set(t) });

    // Orden de prioridad para mostrar algo de inmediato, sin depender de una
    // consulta al backend que podría ser inconsistente justo después de un
    // guardado reciente:
    //   1) Bloques recién generados, pasados por el estado de navegación.
    //   2) Bloques guardados en el caché de esta sesión (de una visita previa).
    //   3) Si no hay nada de lo anterior, sí consultamos al backend.
    const bloquesDesdeNavegacion = (history.state as { bloques?: Bloque[] } | null)?.bloques;
    const bloquesDesdeCache = this.flowCache.getBloques(this.torneoId);
    const bloquesIniciales =
      bloquesDesdeNavegacion && bloquesDesdeNavegacion.length > 0
        ? bloquesDesdeNavegacion
        : bloquesDesdeCache;

    if (bloquesIniciales && bloquesIniciales.length > 0) {
      this.bloques.set(bloquesIniciales);
      this.flowCache.setBloques(this.torneoId, bloquesIniciales);
      this.selectedBloqueId.set(bloquesIniciales[0]._id);
      this.loadCombates();
    } else {
      this.loadBloques();
    }
  }

  loadBloques(reintentoSilencioso = false): void {
    this.loadingBloques.set(true);
    this.bloqueService.findByTorneo(this.torneoId).subscribe({
      next: (bloques) => {
        this.loadingBloques.set(false);

        if (bloques.length > 0) {
          this.bloques.set(bloques);
          this.flowCache.setBloques(this.torneoId, bloques);
          this.selectedBloqueId.set(bloques[0]._id);
          this.loadCombates();
        } else if (!reintentoSilencioso) {
          // Reintento único y silencioso por si la petición llegó justo antes
          // de que terminara de guardarse una generación muy reciente.
          setTimeout(() => this.loadBloques(true), 900);
        }
        // Si sigue vacío tras el reintento, no tocamos `this.bloques` — si ya
        // había algo en pantalla (de caché), lo dejamos como está.
      },
      error: (err) => {
        this.loadingBloques.set(false);
        console.error('[Bloques] Error al cargar bloques del torneo', this.torneoId, err);
        if (this.bloques().length === 0) {
          this.errorMessage.set(
            extractErrorMessage(err, 'No se pudieron cargar los bloques de este torneo.'),
          );
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

    // Mostramos primero lo que haya en caché para este torneo (filtrado al
    // bloque/fase actuales), y de todas formas refrescamos desde la red.
    const cacheados = this.flowCache.getCombates(this.torneoId);
    if (cacheados && cacheados.length > 0) {
      const filtrados = cacheados.filter(
        (c) => c.bloque?._id === this.selectedBloqueId() && c.fase === this.activeFase(),
      );
      if (filtrados.length > 0) {
        this.combates.set(filtrados);
      }
    }

    this.loading.set(true);
    this.combateService
      .findByTorneo(this.torneoId, {
        bloque: this.selectedBloqueId(),
        fase: this.activeFase(),
      })
      .subscribe({
        next: (data) => {
          this.loading.set(false);
          if (data.length > 0) {
            this.combates.set(data);
            this.flowCache.setCombates(this.torneoId, data);
          }
          // Si vuelve vacío pero ya teníamos algo mostrado (de caché), lo
          // dejamos — probablemente es la misma inconsistencia de lectura.
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

    // Mandamos explícitamente los IDs de los bloques que ya tenemos cargados
    // en pantalla, en vez de depender de que el backend los vuelva a buscar
    // por torneoId (para evitar el problema de inconsistencia entre lecturas
    // y escrituras que veníamos arrastrando).
    const bloqueIds = this.bloques().map((b) => b._id);

    this.combateService
      .generar(this.torneoId, { bloqueIds, fase: this.activeFase() })
      .subscribe({
        next: (combatesGenerados) => {
          this.generating.set(false);
          this.successMessage.set('Enfrentamientos generados correctamente.');
          // Usamos directamente lo que acaba de devolver el POST en vez de
          // volver a preguntarle al backend, para no depender de una lectura
          // inmediatamente posterior a la escritura.
          this.flowCache.setCombates(this.torneoId, combatesGenerados);
          this.combates.set(
            this.selectedBloqueId()
              ? combatesGenerados.filter((c) => c.bloque?._id === this.selectedBloqueId())
              : combatesGenerados,
          );
        },
        error: (err) => {
          this.generating.set(false);
          this.errorMessage.set(
            extractErrorMessage(err, 'No se pudieron generar los enfrentamientos.'),
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
