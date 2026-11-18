import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, catchError, exhaustMap, of, timer } from 'rxjs';

import { RankingSeguilineas } from '../../core/models/seguilineas.model';
import { SeguilineasService } from '../../core/services/seguilineas.service';
import {
  ItemBarra,
  MAX_ALERTAS,
  RefResultado,
  TICKER_MS,
  detectarNuevos,
  fotografiar,
  paginar,
  textoAlerta,
  textoPosicion,
} from './barra-patrocinadores.util';

const POLL_MS = 5_000;
const LOGO_PATROCINADOR = '/image_75528b.png';
/** Con 2 resultados o menos la alerta se muestra fija y centrada, sin desplazarse. */
const MAX_ALERTA_FIJA = 2;

type TipoVista = 'nuevo' | 'ranking' | 'llegada' | 'patrocinador';

interface VistaSinClave {
  tipo: TipoVista;
  etiqueta: string;
  items: ItemBarra[];
  fija: boolean;
  duracionS: number;
}
interface VistaBarra extends VistaSinClave {
  /** Cambia solo cuando la barra pasa a otra pantalla; reinicia la animación. */
  clave: number;
}

/**
 * Barra inferior de patrocinadores. Cada 30 s alterna entre las posiciones de
 * cada torneo de Seguilineas en progreso y el logo del patrocinador. Cuando se
 * registra un resultado, lo anuncia al momento: tiempo · robot · lugar actual.
 */
@Component({
  selector: 'app-barra-patrocinadores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barra-patrocinadores.component.html',
  styleUrls: ['./barra-patrocinadores.component.css'],
})
export class BarraPatrocinadoresComponent implements OnInit, OnDestroy {
  vistas: VistaBarra[] = [];

  private readonly api = inject(SeguilineasService);
  private readonly subs = new Subscription();

  private torneos: RankingSeguilineas[] = [];
  /** null hasta la primera respuesta: esa carga no genera alertas. */
  private previo: { firmas: Map<string, string>; torneoIds: Set<string> } | null = null;
  /** Resultados nuevos en pantalla (el más reciente primero). Vacío = ciclo normal. */
  private alertas: RefResultado[] = [];
  private indice = 0;
  private clave = 0;
  private firmaVista = '';
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  trackVista = (_: number, v: VistaBarra): number => v.clave;
  trackItem = (i: number): number => i;

  ngOnInit(): void {
    this.mostrar(true); // mientras llega el primer dato: solo el patrocinador

    this.subs.add(
      timer(0, POLL_MS)
        .pipe(
          exhaustMap(() =>
            this.api.activos().pipe(catchError(() => of(null))),
          ),
        )
        .subscribe((torneos) => {
          if (torneos) this.recibir(torneos);
        }),
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
    this.subs.unsubscribe();
  }

  private recibir(torneos: RankingSeguilineas[]): void {
    const primeraCarga = this.previo === null;
    const nuevos = detectarNuevos(this.previo, torneos);

    this.torneos = torneos;
    this.previo = {
      firmas: fotografiar(torneos),
      torneoIds: new Set(torneos.map((t) => t.id)),
    };

    if (primeraCarga) {
      this.indice = 0;
      this.mostrar(true);
      this.programar();
      return;
    }

    if (nuevos.length) {
      // Se suma a lo que ya esté en pantalla, sin repetir robot.
      const vistos = new Set<string>();
      this.alertas = [...nuevos, ...this.alertas]
        .filter((r) => {
          const k = `${r.torneoId}|${r.robotId}`;
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        })
        .slice(0, MAX_ALERTAS);
      this.mostrar(true);
      this.programar(); // la alerta dura un ciclo completo (30 s)
      return;
    }

    this.mostrar(false); // refresca posiciones y tiempos sin reiniciar la animación
  }

  private programar(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.avanzar(), TICKER_MS);
  }

  private avanzar(): void {
    this.alertas = []; // la alerta (si la había) ya tuvo su tiempo
    this.indice++;
    this.mostrar(true);
    this.programar();
  }

  /** `cambio`: pasa a otra pantalla (reinicia la animación); si no, solo actualiza datos. */
  private mostrar(cambio: boolean): void {
    const vista = this.construirVista();
    const firma = JSON.stringify(vista);
    if (!cambio && firma === this.firmaVista) return;
    this.firmaVista = firma;
    if (cambio) this.clave++;
    this.vistas = [{ ...vista, clave: this.clave }];
  }

  private construirVista(): VistaSinClave {
    if (this.alertas.length) {
      const alerta = this.vistaAlertas();
      if (alerta) return alerta;
      this.alertas = []; // los robots de la alerta ya no están activos
    }
    const ciclo = this.vistasCiclo();
    return ciclo[this.indice % ciclo.length];
  }

  /** Los resultados recién registrados, con el tiempo y el lugar que tienen AHORA. */
  private vistaAlertas(): VistaSinClave | null {
    const variosTorneos = this.torneos.length > 1;
    const items: ItemBarra[] = [];
    for (const ref of this.alertas) {
      const torneo = this.torneos.find((t) => t.id === ref.torneoId);
      const fila = torneo?.ranking.find((f) => f.robotId === ref.robotId);
      if (torneo && fila?.estadoRegistro)
        items.push({ texto: textoAlerta(fila, variosTorneos ? torneo.nombre : null) });
    }
    if (!items.length) return null;
    return items.length <= MAX_ALERTA_FIJA
      ? { tipo: 'nuevo', etiqueta: 'NUEVO RESULTADO', items, fija: true, duracionS: 0 }
      : this.marquesina('nuevo', 'NUEVO RESULTADO', items);
  }

  /** Posiciones de cada torneo activo (paginadas) y, al final, el patrocinador. */
  private vistasCiclo(): VistaSinClave[] {
    const vistas: VistaSinClave[] = [];

    for (const t of this.torneos) {
      const nombre = t.nombre.toUpperCase();
      const conResultado = t.ranking.filter((f) => f.estadoRegistro);

      if (conResultado.length) {
        const paginas = paginar(conResultado);
        paginas.forEach((pagina, i) =>
          vistas.push(
            this.marquesina(
              'ranking',
              `POSICIONES · ${nombre}${paginas.length > 1 ? ` (${i + 1}/${paginas.length})` : ''}`,
              pagina.map((f) => ({ texto: textoPosicion(f) })),
            ),
          ),
        );
      } else if (t.cola.length) {
        // Torneo en progreso sin ningún resultado todavía: orden de salida.
        const paginas = paginar(t.cola);
        paginas.forEach((pagina, i) =>
          vistas.push(
            this.marquesina(
              'llegada',
              `ORDEN DE SALIDA · ${nombre}${paginas.length > 1 ? ` (${i + 1}/${paginas.length})` : ''}`,
              pagina.map((c) => ({ texto: `${c.ordenLlegada}. ${c.nombre}` })),
            ),
          ),
        );
      }
    }

    // Siempre es parte del ciclo; es el único estado cuando no hay datos.
    vistas.push(
      this.marquesina('patrocinador', 'PATROCINADOR', [{ logo: LOGO_PATROCINADOR }]),
    );
    return vistas;
  }

  /** Repite los items hasta cubrir el ancho y duplica la pista para un bucle sin saltos (-50 %). */
  private marquesina(tipo: TipoVista, etiqueta: string, items: ItemBarra[]): VistaSinClave {
    let base = items;
    while (base.length < 6) base = [...base, ...items];
    return {
      tipo,
      etiqueta,
      items: [...base, ...base],
      fija: false,
      duracionS: Math.max(20, base.length * 5),
    };
  }
}
