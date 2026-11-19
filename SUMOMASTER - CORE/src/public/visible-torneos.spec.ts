import { seleccionarTorneosVisiblesEnLive } from './visible-torneos';

describe('seleccionarTorneosVisiblesEnLive', () => {
  it('ocultar uno de tres deja visibles los otros dos', () => {
    const torneos = [
      { id: 'a', visibleEnLive: true },
      { id: 'b', visibleEnLive: false },
      { id: 'c', visibleEnLive: true },
    ];

    expect(seleccionarTorneosVisiblesEnLive(torneos).map(({ id }) => id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('deja la lista vacía al ocultar los tres torneos', () => {
    const torneos = [
      { id: 'a', visibleEnLive: false },
      { id: 'b', visibleEnLive: false },
      { id: 'c', visibleEnLive: false },
    ];

    expect(seleccionarTorneosVisiblesEnLive(torneos)).toEqual([]);
  });

  it('muestra todos los torneos no modificados como visibles', () => {
    const torneos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(seleccionarTorneosVisiblesEnLive(torneos)).toEqual(torneos);
  });
});
