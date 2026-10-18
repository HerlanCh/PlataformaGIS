import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIN_FILTROS } from '../domain/filtros.js';
import { CENTRO_LA_PAZ } from '../domain/geo.js';
import type { ReportePublico } from '../domain/reportes.js';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { reiniciarAlmacen } from '../services/almacen.js';
import { leerMemoria, recordar } from '../services/memoria.js';
import { ErrorDeZona } from '../services/zonas.js';
import { Encabezado } from '../ui/Encabezado.js';
import { puntosDeCalor } from './calor/capa.js';
import { BarraDeCalor, HerramientasDelMapa } from './calor/ControlesDeCalor.js';
import { categoriasVisibles, useMapaDeCalor } from './calor/usarMapaDeCalor.js';
import { PanelCerca } from './cerca/PanelCerca.js';
import { HojaDeFiltros } from './filtros/HojaDeFiltros.js';
import { AvisoSigueAhi } from './votos/AvisoSigueAhi.js';
import { HojaDeDetalle } from './votos/HojaDeDetalle.js';
import { useSeguirPosicion } from './votos/usarSigueAhi.js';
import { mensajeDeVoto } from './votos/mensajes.js';
import { EditorDeZona } from './zonas/EditorDeZona.js';
import { HojaDeZonas } from './zonas/HojaDeZonas.js';
import { mensajeDeZona } from './zonas/usarZonas.js';

const ID = '33333333-3333-4333-8333-333333333333';

const reporte = (norteM = 300, cambios: Partial<ReportePublico> = {}): ReportePublico => ({
  id: ID,
  codigoCategoria: 'bloqueo',
  estado: 'ACTIVO',
  publicLocation: {
    latitud: CENTRO_LA_PAZ.latitud + norteM / 111_195,
    longitud: CENTRO_LA_PAZ.longitud,
  },
  creadoEn: '2026-10-18T12:00:00.000Z',
  caducaEn: '2026-10-18T18:00:00.000Z',
  ...cambios,
});

const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

type Ruta = (solicitud: Request) => Response | undefined;
const pedidos: Request[] = [];

/** La API falsa: registra el dispositivo y responde con la primera ruta que conteste. */
function api(...rutas: Ruta[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const solicitud = new Request(entrada, init);
      pedidos.push(solicitud.clone());
      if (solicitud.url.endsWith('/v1/dispositivos')) {
        return json({
          idUsuario: '11111111-1111-4111-8111-111111111111',
          token: 'tok',
          expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
        });
      }
      for (const ruta of rutas) {
        const respuesta = ruta(solicitud);
        if (respuesta) return respuesta;
      }
      return json({}, 500);
    }),
  );
}

const montar = (hijo: ReactNode) => {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={consulta}>{hijo}</QueryClientProvider>);
};

const gps = (punto = CENTRO_LA_PAZ, error?: { code: number }) =>
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void, falla: (e: unknown) => void) =>
        error
          ? falla(error)
          : ok({ coords: { latitude: punto.latitud, longitude: punto.longitud } }),
    },
  });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  pedidos.length = 0;
  useEstado.setState({
    aviso: null,
    detalle: null,
    posicion: null,
    ventana: null,
    filtros: SIN_FILTROS,
    filtrosAbiertos: false,
    capa: 'incidentes',
    diasDeCalor: 30,
    calorDisponible: true,
    zonasAbiertas: false,
    zonaEnEdicion: null,
  });
  gps();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const textoDelAviso = () => useEstado.getState().aviso?.texto;

describe('detalle del reporte y votos (HU-03)', () => {
  const abrir = (lista = [reporte()]) => {
    useEstado.setState({ detalle: ID, posicion: CENTRO_LA_PAZ });
    return montar(<HojaDeDetalle reportes={lista} />);
  };

  it('HU-03: muestra la línea, el estado, la distancia y la vigencia', async () => {
    abrir();

    expect(screen.getByRole('heading', { name: 'Bloqueo o protesta vial' })).toBeTruthy();
    expect(screen.getByText('Línea Amarilla')).toBeTruthy();
    expect(screen.getByText('Sin confirmar')).toBeTruthy();
    expect(screen.getByText('a 300 m de ti')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Sigue ahí' })).toBeTruthy();
  });

  it('HU-03: «Sigue ahí» vota con la posición del GPS, agradece y cierra', async () => {
    api((s) => (s.url.endsWith('/confirmar') ? json({ peso: 1, decision: 'NINGUNA' }) : undefined));
    abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Sigue ahí' }));

    await waitFor(() => expect(textoDelAviso()).toBe('Gracias. Confirmaste que sigue ahí.'));
    expect(useEstado.getState().detalle).toBeNull();
    const voto = pedidos.find((p) => p.url.endsWith(`/v1/reportes/${ID}/confirmar`))!;
    expect(await voto.json()).toEqual(CENTRO_LA_PAZ);
  });

  it('HU-03: lejos del incidente se explica y la hoja sigue abierta', async () => {
    api(() => json({ codigo: 'DEMASIADO_LEJOS_PARA_VOTAR' }, 403));
    abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Ya no está' }));

    await waitFor(() =>
      expect(textoDelAviso()).toBe('Acércate a menos de 1 km del incidente para votar.'),
    );
    expect(useEstado.getState().detalle).toBe(ID);
  });

  it('sin permiso de ubicación pide activarla para votar', async () => {
    gps(CENTRO_LA_PAZ, { code: 1 });
    abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Sigue ahí' }));

    await waitFor(() =>
      expect(textoDelAviso()).toBe('Activa la ubicación para votar: el voto usa tu posición.'),
    );
  });

  it('HU-03: en un reporte propio no ofrece votar', async () => {
    await recordar(ID, { propio: true });
    abrir([reporte(300, { estado: 'CONFIRMADO' })]);

    expect(await screen.findByText(/Lo reportaste tú/)).toBeTruthy();
    expect(screen.getByText('Confirmado por la comunidad')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sigue ahí' })).toBeNull();
  });

  it('si el reporte deja de estar en el mapa, la hoja se cierra con un aviso', () => {
    const { rerender } = abrir();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <HojaDeDetalle reportes={[]} />
      </QueryClientProvider>,
    );

    expect(useEstado.getState().detalle).toBeNull();
    expect(textoDelAviso()).toBe('Este incidente ya no está en el mapa.');
  });

  it('no tiene infracciones de accesibilidad', async () => {
    const { container } = abrir();
    await screen.findByRole('button', { name: 'Sigue ahí' });

    expect(await infracciones(container)).toEqual([]);
  });

  it('cada respuesta al voto tiene su mensaje', () => {
    const rechazo = (codigo: string, reintentarEnS: number | null = null) =>
      mensajeDeVoto({ tipo: 'RECHAZADO', codigo, reintentarEnS }, 'CONFIRMACION').texto;

    expect(mensajeDeVoto({ tipo: 'REGISTRADO', decision: 'RESOLVER' }, 'NEGACION').texto).toBe(
      'Gracias. Avisaste que ya no está.',
    );
    expect(mensajeDeVoto({ tipo: 'SIN_RED' }, 'NEGACION').texto).toMatch(/Sin conexión/);
    expect(rechazo('YA_VOTO')).toBe('Ya habías votado por este incidente.');
    expect(rechazo('AUTOR_NO_PUEDE_VOTAR')).toMatch(/Lo reportaste tú/);
    expect(rechazo('REPORTE_NO_ACTIVO')).toBe('Este incidente ya no está activo.');
    expect(rechazo('LIMITE_EXCEDIDO', 300)).toBe(
      'Votaste muchas veces seguidas. Podrás votar de nuevo en 5 min.',
    );
    expect(rechazo('LIMITE_EXCEDIDO')).toBe(
      'Votaste muchas veces seguidas. Podrás votar de nuevo.',
    );
    expect(rechazo('OTRO')).toBe('No se pudo registrar tu voto. Intenta de nuevo.');
  });
});

describe('«¿Sigue ahí?» automático (HU-03)', () => {
  it('HU-03: aparece a menos de 150 m, una sola vez por reporte', async () => {
    useEstado.setState({ posicion: CENTRO_LA_PAZ });
    const lista = [reporte(30)];
    const { unmount } = montar(<AvisoSigueAhi reportes={lista} />);

    expect(
      await screen.findByRole('heading', { name: '¿Sigue ahí el bloqueo a 30 m?' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No sé' }));
    await waitFor(() => expect(screen.queryByText('No sé')).toBeNull());
    await waitFor(async () =>
      expect((await leerMemoria()).get(ID)).toMatchObject({ preguntado: true }),
    );

    unmount();
    montar(<AvisoSigueAhi reportes={lista} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText('No sé')).toBeNull();
  });

  it('HU-03: responder vota y la tarjeta se va', async () => {
    api((s) => (s.url.endsWith('/negar') ? json({ peso: 1, decision: 'RESOLVER' }) : undefined));
    useEstado.setState({ posicion: CENTRO_LA_PAZ });
    montar(<AvisoSigueAhi reportes={[reporte(30)]} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ya no está' }));

    await waitFor(() => expect(textoDelAviso()).toBe('Gracias. Avisaste que ya no está.'));
    expect(screen.queryByRole('button', { name: 'Ya no está' })).toBeNull();
  });

  it('HU-03: no aparece más allá de 150 m ni sin posición', async () => {
    const { unmount } = montar(<AvisoSigueAhi reportes={[reporte(30)]} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText('No sé')).toBeNull();

    unmount();
    useEstado.setState({ posicion: CENTRO_LA_PAZ });
    montar(<AvisoSigueAhi reportes={[reporte(400)]} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText('No sé')).toBeNull();
  });
});

describe('seguir la posición para el «¿Sigue ahí?»', () => {
  it('una posición nueva borra el aviso viejo de «no pudimos obtener tu ubicación»', () => {
    useEstado.getState().avisar('problema', 'No pudimos obtener tu ubicación.');
    useEstado.getState().fijarPosicion(CENTRO_LA_PAZ);
    expect(useEstado.getState().aviso).toBeNull();

    useEstado.getState().avisar('exito', 'Zona guardada.');
    useEstado.getState().fijarPosicion(CENTRO_LA_PAZ);
    expect(textoDelAviso()).toBe('Zona guardada.');
  });

  it('una posición nueva borra el aviso viejo de «no pudimos obtener tu ubicación»', () => {
    useEstado.getState().avisar('problema', 'No pudimos obtener tu ubicación.');
    useEstado.getState().fijarPosicion(CENTRO_LA_PAZ);
    expect(useEstado.getState().aviso).toBeNull();

    useEstado.getState().avisar('exito', 'Zona guardada.');
    useEstado.getState().fijarPosicion(CENTRO_LA_PAZ);
    expect(textoDelAviso()).toBe('Zona guardada.');
  });

  function Seguir() {
    useSeguirPosicion();
    return null;
  }

  const conPermiso = (state: PermissionState) => {
    const watchPosition = vi.fn((ok: (p: unknown) => void) => {
      ok({ coords: { latitude: -16.5, longitude: -68.13 } });
      return 7;
    });
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: () =>
          Promise.resolve({ state, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      },
    });
    return { watchPosition, clearWatch };
  };

  it('HU-03: con el permiso concedido sigue la posición y la suelta al cerrar', async () => {
    const { watchPosition, clearWatch } = conPermiso('granted');
    const { unmount } = render(<Seguir />);

    await waitFor(() => expect(watchPosition).toHaveBeenCalledOnce());
    expect(useEstado.getState().posicion).toEqual({ latitud: -16.5, longitud: -68.13 });
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('HU-03: nunca pide el permiso por su cuenta', async () => {
    const { watchPosition } = conPermiso('prompt');
    render(<Seguir />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(watchPosition).not.toHaveBeenCalled();
  });
});

describe('filtros', () => {
  it('apagar una línea y elegir la antigüedad cambia los filtros y se recuerda', () => {
    useEstado.setState({ filtrosAbiertos: true });
    render(<HojaDeFiltros />);

    fireEvent.click(screen.getByRole('button', { name: /Hecho delictivo o robo/ }));
    fireEvent.click(screen.getByRole('radio', { name: '1 hora' }));

    expect(useEstado.getState().filtros).toEqual({ ocultas: ['robo'], antiguedad: 'hora' });
    expect(screen.getByRole('button', { name: /Hecho delictivo o robo/ }).ariaPressed).toBe(
      'false',
    );
    expect(JSON.parse(localStorage.getItem('alerta-lp:filtros')!)).toEqual({
      ocultas: ['robo'],
      antiguedad: 'hora',
    });

    fireEvent.click(screen.getByRole('button', { name: /Hecho delictivo o robo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));

    expect(useEstado.getState().filtros).toEqual(SIN_FILTROS);
    expect(useEstado.getState().filtrosAbiertos).toBe(false);
  });

  it('la franja del encabezado marca las líneas ocultas', () => {
    useEstado.setState({ filtros: { ocultas: ['jauria'], antiguedad: 'todos' } });
    const { container } = render(<Encabezado />);

    expect(container.querySelectorAll('.red__linea[data-oculta]')).toHaveLength(1);
    expect(screen.getByText(/Jauría de perros agresivos \(oculta por los filtros\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mis zonas' }));
    expect(useEstado.getState().zonasAbiertas).toBe(true);
  });

  it('el panel dice cuántos incidentes esconden los filtros y permite quitarlos', () => {
    useEstado.setState({ filtros: { ocultas: ['robo'], antiguedad: 'todos' } });
    render(
      <PanelCerca
        reportes={[]}
        ocultos={2}
        desde={CENTRO_LA_PAZ}
        origen="gps"
        cargando={false}
        fallo={false}
        reintentar={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 incidentes ocultos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(useEstado.getState().filtros).toEqual(SIN_FILTROS);
  });

  it('tocar una fila del panel abre su detalle', () => {
    render(
      <PanelCerca
        reportes={[reporte()]}
        desde={CENTRO_LA_PAZ}
        origen="gps"
        cargando={false}
        fallo={false}
        reintentar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Bloqueo/ }));

    expect(useEstado.getState().detalle).toBe(ID);
  });

  it('no tiene infracciones de accesibilidad', async () => {
    useEstado.setState({ filtrosAbiertos: true });
    const { container } = render(<HojaDeFiltros />);

    expect(await infracciones(container)).toEqual([]);
  });
});

describe('mapa de calor (HU-06)', () => {
  it('el interruptor cambia entre ahora e historial y abre los filtros', () => {
    render(<HerramientasDelMapa />);

    fireEvent.click(screen.getByRole('radio', { name: 'Historial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));

    expect(useEstado.getState().capa).toBe('calor');
    expect(useEstado.getState().filtrosAbiertos).toBe(true);
  });

  it('HU-06: la barra explica el umbral, el periodo y los estados', () => {
    const { rerender } = render(<BarraDeCalor cantidad={4} cargando={false} fallo={false} />);
    expect(screen.getByText(/Solo zonas con 3 o más/)).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '90 días' }));
    expect(useEstado.getState().diasDeCalor).toBe(90);

    rerender(<BarraDeCalor cantidad={0} cargando={false} fallo={false} />);
    expect(screen.getByText(/No hay zonas con 3 o más reportes/)).toBeTruthy();
    rerender(<BarraDeCalor cantidad={null} cargando fallo={false} />);
    expect(screen.getByText('Cargando el historial…')).toBeTruthy();
    rerender(<BarraDeCalor cantidad={null} cargando={false} fallo />);
    expect(screen.getByText(/No pudimos cargar el historial/)).toBeTruthy();
  });

  function Celdas() {
    const { celdas } = useMapaDeCalor();
    return <p>{celdas === null ? 'sin datos' : `${celdas.length} celdas`}</p>;
  }

  const ventana = {
    latitudMin: -16.51,
    latitudMax: -16.48,
    longitudMin: -68.15,
    longitudMax: -68.12,
  };

  it('HU-06: pide la ventana, el periodo y solo las líneas visibles', async () => {
    api((s) =>
      s.url.includes('/v1/mapa-calor')
        ? json({ celdas: [{ latitud: -16.5, longitud: -68.13, cantidad: 3 }] })
        : undefined,
    );
    useEstado.setState({
      ventana,
      capa: 'calor',
      diasDeCalor: 7,
      filtros: { ocultas: ['robo', 'jauria'], antiguedad: 'todos' },
    });
    montar(<Celdas />);

    expect(await screen.findByText('1 celdas')).toBeTruthy();
    const url = new URL(pedidos.find((p) => p.url.includes('/v1/mapa-calor'))!.url);
    expect(url.searchParams.get('categorias')).toBe('bloqueo,accidente,infraestructura');
    const dias =
      (Date.parse(url.searchParams.get('hasta')!) - Date.parse(url.searchParams.get('desde')!)) /
      86_400_000;
    expect(dias).toBe(7);
  });

  it('si la API no tiene el mapa de calor (404), se esconde el interruptor', async () => {
    api(() => json({}, 404));
    useEstado.setState({ ventana, capa: 'calor' });
    montar(<Celdas />);

    await waitFor(() => expect(useEstado.getState().calorDisponible).toBe(false));
    expect(useEstado.getState().capa).toBe('incidentes');
    render(<HerramientasDelMapa />);
    expect(screen.queryByRole('radio', { name: 'Historial' })).toBeNull();
  });

  it('sin líneas visibles no pide nada', () => {
    useEstado.setState({
      ventana,
      capa: 'calor',
      filtros: {
        ocultas: ['bloqueo', 'accidente', 'robo', 'infraestructura', 'jauria'],
        antiguedad: 'todos',
      },
    });
    montar(<Celdas />);

    expect(screen.getByText('0 celdas')).toBeTruthy();
    expect(categoriasVisibles([])).toBeUndefined();
  });

  it('la intensidad de cada celda es su puesto entre todas', () => {
    const puntos = puntosDeCalor([
      { latitud: 1, longitud: 1, cantidad: 3 },
      { latitud: 2, longitud: 2, cantidad: 9 },
    ]);

    expect(puntos).toEqual([
      [1, 1, 0.25],
      [2, 2, 1],
    ]);
    expect(puntosDeCalor([])).toEqual([]);
  });
});

describe('zonas suscritas (HU-07)', () => {
  const zona = (n: number) => ({
    id: `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`,
    centro: CENTRO_LA_PAZ,
    radioM: 800,
    categorias: ['bloqueo', 'robo'],
    creadoEn: '2026-10-18T12:00:00.000Z',
  });

  it('HU-07: lista las zonas y elimina una tras confirmarlo', async () => {
    let zonas = [zona(1)];
    api((s) => {
      if (!s.url.includes('/v1/suscripciones')) return undefined;
      if (s.method === 'DELETE') {
        zonas = [];
        return json(null, 204);
      }
      return json({ zonas });
    });
    useEstado.setState({ zonasAbiertas: true });
    montar(<HojaDeZonas />);

    expect(await screen.findByText('Zona 1 · radio de 800 m')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar la zona 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    expect(await screen.findByText(/Aún no tienes zonas/)).toBeTruthy();
    expect(textoDelAviso()).toBe('Zona eliminada.');
  });

  it('HU-07: con 5 zonas no deja crear otra y explica por qué', async () => {
    api((s) =>
      s.url.includes('/v1/suscripciones') ? json({ zonas: [1, 2, 3, 4, 5].map(zona) }) : undefined,
    );
    useEstado.setState({ zonasAbiertas: true });
    montar(<HojaDeZonas />);

    const nueva = await screen.findByRole('button', { name: 'Nueva zona' });
    expect((nueva as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Llegaste al máximo de 5 zonas/)).toBeTruthy();
  });

  it('«Nueva zona» pasa el mapa al modo de dibujo', async () => {
    api((s) => (s.url.includes('/v1/suscripciones') ? json({ zonas: [] }) : undefined));
    useEstado.setState({ zonasAbiertas: true, capa: 'calor' });
    montar(<HojaDeZonas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva zona' }));

    expect(useEstado.getState()).toMatchObject({
      zonasAbiertas: false,
      capa: 'incidentes',
      zonaEnEdicion: { radioM: 500, centro: null },
    });
  });

  it('si las zonas no están disponibles (404) lo dice', async () => {
    api(() => json({}, 404));
    useEstado.setState({ zonasAbiertas: true });
    montar(<HojaDeZonas />);

    expect(await screen.findByText('Las zonas no están disponibles por ahora.')).toBeTruthy();
  });

  it('HU-07: el editor guarda el centro bajo la mira, el radio y las líneas elegidas', async () => {
    api((s) => {
      if (!s.url.includes('/v1/suscripciones')) return undefined;
      return s.method === 'POST' ? json(zona(1), 201) : json({ zonas: [] });
    });
    useEstado.setState({ zonaEnEdicion: { radioM: 500, centro: CENTRO_LA_PAZ } });
    montar(<EditorDeZona />);

    fireEvent.change(screen.getByLabelText('Radio'), { target: { value: '1200' } });
    expect(screen.getByText('1,2 km')).toBeTruthy();
    for (const linea of ['Accidente', 'Robo', 'Vía dañada', 'Jauría']) {
      fireEvent.click(screen.getByRole('button', { name: linea }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Guardar zona' }));

    await waitFor(() => expect(textoDelAviso()).toBe('Zona guardada.'));
    const creada = pedidos.find((p) => p.method === 'POST' && p.url.includes('suscripciones'))!;
    expect(await creada.json()).toEqual({
      ...CENTRO_LA_PAZ,
      radioM: 1200,
      categorias: ['bloqueo'],
    });
    expect(useEstado.getState()).toMatchObject({ zonaEnEdicion: null, zonasAbiertas: true });
  });

  it('sin líneas elegidas no se puede guardar; cancelar sale del modo de dibujo', () => {
    useEstado.setState({ zonaEnEdicion: { radioM: 500, centro: CENTRO_LA_PAZ } });
    montar(<EditorDeZona />);

    for (const linea of ['Bloqueo', 'Accidente', 'Robo', 'Vía dañada', 'Jauría']) {
      fireEvent.click(screen.getByRole('button', { name: linea }));
    }

    expect(screen.getByText('Elige al menos una línea.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Guardar zona' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(useEstado.getState().zonaEnEdicion).toBeNull();
  });

  it('cada rechazo de zona tiene su mensaje', () => {
    const conCodigo = (codigo: string) =>
      mensajeDeZona(new ErrorDeZona({ tipo: 'RECHAZADO', codigo, reintentarEnS: null })).texto;

    expect(conCodigo('LIMITE_DE_ZONAS')).toBe('Ya tienes 5 zonas. Elimina una para crear otra.');
    expect(conCodigo('RADIO_INVALIDO')).toBe('El radio debe estar entre 100 m y 2000 m.');
    expect(conCodigo('DESCONOCIDO')).toMatch(/No pudimos guardar el cambio/);
    expect(mensajeDeZona(new Error('red')).texto).toMatch(/Revisa tu conexión/);
  });

  it('no tiene infracciones de accesibilidad', async () => {
    api((s) => (s.url.includes('/v1/suscripciones') ? json({ zonas: [zona(1)] }) : undefined));
    useEstado.setState({ zonasAbiertas: true });
    const { container } = montar(<HojaDeZonas />);
    // En la CI la lista puede tardar más que la espera por defecto de 1 s.
    await screen.findByText('Zona 1 · radio de 800 m', {}, { timeout: 5000 });

    expect(await infracciones(container)).toEqual([]);
  });

  it('el editor no tiene infracciones de accesibilidad', async () => {
    useEstado.setState({ zonaEnEdicion: { radioM: 500, centro: CENTRO_LA_PAZ } });
    const { container } = montar(<EditorDeZona />);

    expect(await infracciones(container)).toEqual([]);
  });
});
