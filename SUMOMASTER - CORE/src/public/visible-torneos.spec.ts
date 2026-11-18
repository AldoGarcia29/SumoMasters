import { seleccionarTorneosVisiblesEnLive } from './visible-torneos';

describe('seleccionarTorneosVisiblesEnLive', () => {
  it('muestra los torneos marcados y actualiza la lista al desmarcar uno', () => {
    const torneos = [
      { id: 'a', visibleEnLive: true },
      { id: 'b', visibleEnLive: true },
      { id: 'c', visibleEnLive: false },
    ];

    expect(seleccionarTorneosVisiblesEnLive(torneos).map(({ id }) => id)).toEqual([
      'a',
      'b',
    ]);

    torneos[1].visibleEnLive = false;
    expect(seleccionarTorneosVisiblesEnLive(torneos).map(({ id }) => id)).toEqual([
      'a',
    ]);
  });

  it('muestra todos los torneos públicos cuando ninguno está marcado', () => {
    const torneos = [
      { id: 'a', visibleEnLive: false },
      { id: 'b' },
    ];

    expect(seleccionarTorneosVisiblesEnLive(torneos)).toEqual(torneos);
  });
});
