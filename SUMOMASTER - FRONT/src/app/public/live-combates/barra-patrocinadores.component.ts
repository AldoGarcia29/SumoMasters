import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, catchError, exhaustMap, of, timer } from 'rxjs';

import type { RankingSeguilineas } from '../../core/models/seguilineas.model';
import { SeguilineasService } from '../../core/services/seguilineas.service';
import {
  MAX_ALERTAS,
  TICKER_MS,
  detectarNuevos,
  fotografiar,
  paginar,
  textoAlerta,
  textoPosicion,
} from './barra-patrocinadores.util';
import type { ItemBarra, RefResultado } from './barra-patrocinadores.util';

const POLL_MS = 5_000;
const MAX_ALERTA_FIJA = 2;

const PATROCINADORES: ItemBarra[] = [
  {
    logo: '/patrocinadores/lubna.jpeg',
    nombreLogo: 'Lubna Natural Goods',
  },
  {
    logo: '/patrocinadores/uteq.png',
    nombreLogo: 'Universidad Tecnológica de Querétaro',
  },
];

type TipoVista = 'nuevo' | 'ranking' | 'llegada' | 'patrocinador';

interface VistaSinClave {
  tipo: TipoVista;
  etiqueta: string;
  items: ItemBarra[];
  fija: boolean;
  duracionS: number;
}

interface VistaBarra extends VistaSinClave {
  clave: number;
}

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
  private previo: { firmas: Map<string, string>; torneoIds: Set<string> } | null = null;
  private alertas: RefResultado[] = [];
  private indice = 0;
  private clave = 0;
  private firmaVista = '';
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  trackVista = (_: number, vista: VistaBarra): number => vista.clave;
  trackItem = (indice: number): number => indice;

  ngOnInit(): void {
    this.mostrar(true);

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
      torneoIds: new Set(torneos.map((torneo) => torneo.id)),
    };

    if (primeraCarga) {
      this.indice = 0;
      this.mostrar(true);
      this.programar();
      return;
    }

    if (nuevos.length) {
      const vistos = new Set<string>();

      this.alertas = [...nuevos, ...this.alertas]
        .filter((resultado) => {
          const clave = `${resultado.torneoId}|${resultado.robotId}`;
          if (vistos.has(clave)) return false;

          vistos.add(clave);
          return true;
        })
        .slice(0, MAX_ALERTAS);

      this.mostrar(true);
      this.programar();
      return;
    }

    this.mostrar(false);
  }

  private programar(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.avanzar(), TICKER_MS);
  }

  private avanzar(): void {
    this.alertas = [];
    this.indice++;
    this.mostrar(true);
    this.programar();
  }

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

      this.alertas = [];
    }

    const ciclo = this.vistasCiclo();
    return ciclo[this.indice % ciclo.length];
  }

  private vistaAlertas(): VistaSinClave | null {
    const variosTorneos = this.torneos.length > 1;
    const items: ItemBarra[] = [];

    for (const ref of this.alertas) {
      const torneo = this.torneos.find((item) => item.id === ref.torneoId);
      const fila = torneo?.ranking.find((item) => item.robotId === ref.robotId);

      if (torneo && fila?.estadoRegistro) {
        items.push({
          texto: textoAlerta(fila, variosTorneos ? torneo.nombre : null),
        });
      }
    }

    if (!items.length) return null;

    return items.length <= MAX_ALERTA_FIJA
      ? { tipo: 'nuevo', etiqueta: 'NUEVO RESULTADO', items, fija: true, duracionS: 0 }
      : this.marquesina('nuevo', 'NUEVO RESULTADO', items);
  }

  private vistasCiclo(): VistaSinClave[] {
    const vistas: VistaSinClave[] = [];

    for (const torneo of this.torneos) {
      const nombre = torneo.nombre.toUpperCase();
      const conResultado = torneo.ranking.filter((fila) => fila.estadoRegistro);

      if (conResultado.length) {
        const paginas = paginar(conResultado);

        paginas.forEach((pagina, indice) =>
          vistas.push(
            this.marquesina(
              'ranking',
              `POSICIONES · ${nombre}${paginas.length > 1 ? ` (${indice + 1}/${paginas.length})` : ''}`,
              pagina.map((fila) => ({ texto: textoPosicion(fila) })),
            ),
          ),
        );
      } else if (torneo.cola.length) {
        const paginas = paginar(torneo.cola);

        paginas.forEach((pagina, indice) =>
          vistas.push(
            this.marquesina(
              'llegada',
              `ORDEN DE SALIDA · ${nombre}${paginas.length > 1 ? ` (${indice + 1}/${paginas.length})` : ''}`,
              pagina.map((robot) => ({ texto: `${robot.ordenLlegada}. ${robot.nombre}` })),
            ),
          ),
        );
      }
    }

    vistas.push(
      this.marquesina('patrocinador', 'PATROCINADORES', PATROCINADORES),
    );

    return vistas;
  }

  private marquesina(
    tipo: TipoVista,
    etiqueta: string,
    items: ItemBarra[],
  ): VistaSinClave {
    let base = items;

    while (base.length < 6) {
      base = [...base, ...items];
    }

    return {
      tipo,
      etiqueta,
      items: [...base, ...base],
      fija: false,
      duracionS: Math.max(20, base.length * 5),
    };
  }
}