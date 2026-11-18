import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  EstadoRegistro,
  EstadoTurno,
  FilaSeguilineas,
  RankingSeguilineas,
  TurnoCola,
  etiquetaResultado,
  formatearTiempo,
  parsearTiempo,
} from '../../core/models/seguilineas.model';
import { SeguilineasService } from '../../core/services/seguilineas.service';
import { extractErrorMessage } from '../../core/utils/error-message.util';

/**
 * Panel de un torneo de Seguilineas.
 *  - /staff/seguilineas/:id → STAFF asignado o ADMIN: registra tiempos, DNF,
 *    descalificaciones, gestiona la cola de turnos y finaliza.
 *  - /live/seguilineas/:id  → vista pública de solo lectura en tiempo real.
 */
@Component({
  selector: 'app-seguilineas-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './seguilineas-panel.component.html',
  styleUrl: './seguilineas-panel.component.scss',
})
export class SeguilineasPanelComponent implements OnInit {
  private readonly api = inject(SeguilineasService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly soloLectura = !!this.route.snapshot.data['soloLectura'];
  readonly data = signal<RankingSeguilineas | null>(null);
  readonly error = signal('');
  readonly ocupado = signal(false);
  readonly fmt = formatearTiempo;
  readonly resultado = etiquetaResultado;

  readonly finalizado = computed(() => this.data()?.estado === 'Finalizado');
  readonly puedeEditar = computed(() => !this.soloLectura);
  readonly puedeRegistrar = computed(
    () => !this.soloLectura && !this.finalizado(),
  );
  /** Podio a mostrar: fijo si finalizó, o top 3 provisional. */
  readonly podio = computed<{ nombre: string; mejorTiempoMs: number | null }[]>(
    () => {
      const d = this.data();
      if (!d) return [];
      return d.estado === 'Finalizado' && d.podio.length ? d.podio : d.top3;
    },
  );
  /** Robots con tiempo válido en el orden actual (base del desempate). */
  readonly validos = computed(
    () => this.data()?.ranking.filter((f) => f.estadoRegistro === 'VALIDO') ?? [],
  );

  robotId = '';
  min = 0;
  seg = 0;
  ms = 0;

  get tiempoMs(): number {
    return (this.min || 0) * 60_000 + (this.seg || 0) * 1_000 + (this.ms || 0);
  }

  trackFila = (_: number, f: { robotId: string }) => f.robotId;

  ngOnInit(): void {
    if (!this.soloLectura) {
      // Valida acceso (STAFF asignado/ADMIN) antes de abrir el stream.
      this.api.gestion(this.id).subscribe({
        next: (d) => this.aplicar(d),
        error: (e) =>
          this.error.set(extractErrorMessage(e, 'Sin acceso a este torneo')),
      });
    }
    this.api
      .streamRanking(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => {
        if (d === null) {
          this.data.set(null);
          this.error.set('Este torneo fue eliminado.');
          return;
        }
        this.aplicar(d);
      });
  }

  private aplicar(d: RankingSeguilineas): void {
    this.data.set(d);
    this.error.set('');
    // Si el robot seleccionado ya no existe en el torneo, limpiar el selector
    if (this.robotId && !d.cola.some((c) => c.robotId === this.robotId))
      this.robotId = '';
  }

  /** Ejecuta una mutación y aplica el ranking devuelto. */
  private ejecutar(
    peticion: Observable<RankingSeguilineas>,
    msgError: string,
    despues?: () => void,
  ): void {
    this.ocupado.set(true);
    peticion.subscribe({
      next: (d) => {
        this.ocupado.set(false);
        this.aplicar(d);
        despues?.();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(extractErrorMessage(e, msgError));
      },
    });
  }

  // ───────── registrar ─────────

  registrar(estado: EstadoRegistro = 'VALIDO'): void {
    if (!this.robotId) return;
    const datos =
      estado === 'VALIDO' ? { tiempoMs: this.tiempoMs } : { estado };
    if (estado === 'VALIDO' && !this.tiempoMs) return;
    this.ejecutar(
      this.api.registrarTiempo(this.id, this.robotId, datos),
      'No se pudo registrar el resultado',
      () => {
        this.min = this.seg = this.ms = 0;
        this.robotId = '';
      },
    );
  }

  editar(f: FilaSeguilineas): void {
    const actual =
      f.estadoRegistro === 'VALIDO' ? formatearTiempo(f.mejorTiempoMs) : '';
    const texto = prompt(
      `Nuevo resultado para ${f.nombre}.\nEscribe un tiempo (mm:ss.mmm), DNF o DQ.`,
      actual || 'DNF',
    );
    if (texto === null) return;
    const t = texto.trim().toUpperCase();
    if (t === 'DNF' || t === 'DQ' || t === 'DESCALIFICADO') {
      const estado: EstadoRegistro = t === 'DNF' ? 'DNF' : 'DESCALIFICADO';
      this.ejecutar(
        this.api.editarTiempo(this.id, f.robotId, { estado }),
        'No se pudo editar el resultado',
      );
      return;
    }
    const ms = parsearTiempo(texto);
    if (ms === null) {
      this.error.set('Formato inválido. Usa mm:ss.mmm (ej. 00:12.345), DNF o DQ.');
      return;
    }
    this.ejecutar(
      this.api.editarTiempo(this.id, f.robotId, { estado: 'VALIDO', tiempoMs: ms }),
      'No se pudo editar el resultado',
    );
  }

  borrar(f: FilaSeguilineas): void {
    if (
      !confirm(
        `¿Eliminar el resultado de ${f.nombre} (${etiquetaResultado(f.estadoRegistro, f.mejorTiempoMs)})?`,
      )
    )
      return;
    this.ejecutar(
      this.api.eliminarTiempo(this.id, f.robotId),
      'No se pudo eliminar el resultado',
    );
  }

  // ───────── cola de turnos ─────────

  mover(c: TurnoCola, delta: -1 | 1): void {
    const d = this.data();
    if (!d) return;
    const ids = d.cola.map((x) => x.robotId);
    const i = ids.indexOf(c.robotId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.ejecutar(
      this.api.reordenarCola(this.id, ids),
      'No se pudo reordenar la cola',
    );
  }

  turno(c: TurnoCola, estadoTurno: EstadoTurno): void {
    this.ejecutar(
      this.api.marcarTurno(this.id, c.robotId, estadoTurno),
      'No se pudo cambiar el turno',
    );
  }

  // ───────── desempate / cierre ─────────

  /** Un robot se puede mover si su vecino tiene exactamente el mismo tiempo. */
  puedeMoverEmpate(i: number, delta: -1 | 1): boolean {
    const v = this.validos();
    const j = i + delta;
    return (
      j >= 0 && j < v.length && v[j].mejorTiempoMs === v[i].mejorTiempoMs
    );
  }

  moverEmpate(i: number, delta: -1 | 1): void {
    if (!this.puedeMoverEmpate(i, delta)) return;
    const ids = this.validos().map((f) => f.robotId);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    this.ejecutar(
      this.api.reordenarPodio(this.id, ids),
      'No se pudo guardar el desempate',
    );
  }

  finalizar(): void {
    const d = this.data();
    if (!d) return;
    const aviso = d.hayEmpates
      ? '\n\nHay robots empatados: se respetará el orden de desempate actual.'
      : '';
    if (
      !confirm(
        `¿Finalizar el torneo? Ya no se podrán registrar más tiempos.${aviso}`,
      )
    )
      return;
    this.ejecutar(
      this.api.finalizar(this.id, this.validos().map((f) => f.robotId)),
      'No se pudo finalizar el torneo',
    );
  }

  etiquetaAccion(a: string): string {
    return (
      {
        MEJORA: 'Mejoró su tiempo',
        REEMPLAZO: 'Reemplazó su resultado',
        EDICION: 'Editado',
        ELIMINACION: 'Eliminado',
      } as Record<string, string>
    )[a] ?? a;
  }
}
