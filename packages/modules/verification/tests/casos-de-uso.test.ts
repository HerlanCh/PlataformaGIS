import {
  crearEvento,
  reporteConfirmadoV1,
  reporteDuplicadoDetectadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  reporteCaducadoV1,
} from '@gis/contracts';
import type { IdUsuario } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, LimitadorEnMemoria, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { AjustarReputacionPorDesenlace } from '../application/ajustar-reputacion-por-desenlace.js';
import { RegistrarConfirmacionPorDuplicado } from '../application/registrar-confirmacion-por-duplicado.js';
import { ConfirmarReporte, LIMITE_DE_VOTOS, NegarReporte } from '../application/votar-reporte.js';
import type { InstantaneaDeReporte } from '../domain/report-snapshot.js';
import { Reputacion } from '../domain/reputation.js';
import type { ValorVoto } from '../domain/vote.js';
import {
  ConsultaDeReporteFalsa,
  ReputacionesEnMemoria,
  UnidadDeTrabajoVotoEnMemoria,
  VotosEnMemoria,
} from './dobles.js';
import { aMetros, AUTOR, ID_REPORTE, reporte, usuario, voto } from './fixtures.js';

function escenario(instantanea: InstantaneaDeReporte = reporte()) {
  const consultaDeReporte = new ConsultaDeReporteFalsa();
  consultaDeReporte.reportes.set(instantanea.id, instantanea);
  const votos = new VotosEnMemoria();
  const reputaciones = new ReputacionesEnMemoria();
  const unidadDeTrabajo = new UnidadDeTrabajoVotoEnMemoria(votos, reputaciones);
  const reloj = new RelojFijo();
  const deps = {
    consultaDeReporte,
    votos,
    reputaciones,
    unidadDeTrabajo,
    reloj,
    ids: new GeneradorDeIdSecuencial(),
    limitador: new LimitadorEnMemoria(reloj),
  };

  /** Deja votos previos y la reputación con la que el usuario `n` votará. */
  const conVotos = (...previos: [n: number, valor: ValorVoto, peso: number][]) => {
    for (const [n, valor, peso] of previos) votos.filas.push(voto(n, valor, peso));
  };
  const conReputacion = async (idUsuario: IdUsuario, puntaje: number, penalizadoEn?: Date) =>
    reputaciones.guardar(
      Reputacion.restaurar({ idUsuario, puntaje, ultimaPenalizacionEn: penalizadoEn ?? null }),
    );
  return { deps, votos, reputaciones, unidadDeTrabajo, reloj, conVotos, conReputacion };
}

const cerca = aMetros(300);
const entrada = (n: number, punto = cerca) => ({
  idReporte: ID_REPORTE,
  idVotante: usuario(n),
  latitud: punto.latitud,
  longitud: punto.longitud,
});

describe('ConfirmarReporte y NegarReporte', () => {
  it('HU-03: la confirmación que alcanza 3.0 con 2 votantes decide CONFIRMAR', async () => {
    const { deps, conVotos, unidadDeTrabajo } = escenario(reporte({ estado: 'ACTIVO' }));
    conVotos([1, 'CONFIRMACION', 2.0]);

    const resultado = await new ConfirmarReporte(deps).ejecutar(entrada(2));

    expect(resultado).toEqual({ peso: 1, decision: 'CONFIRMAR' });
    expect(unidadDeTrabajo.eventos).toMatchObject([
      {
        tipo: 'VotoEmitido',
        contenido: {
          idReporte: ID_REPORTE,
          idVotante: usuario(2),
          valor: 'CONFIRMACION',
          peso: 1,
          decision: 'CONFIRMAR',
        },
      },
    ]);
  });

  it('HU-03: las negaciones que alcanzan 3.0 deciden RESOLVER', async () => {
    const { deps, conVotos } = escenario();
    conVotos([1, 'NEGACION', 1.0], [2, 'NEGACION', 1.0]);

    const resultado = await new NegarReporte(deps).ejecutar(entrada(3));

    expect(resultado.decision).toBe('RESOLVER');
  });

  it('HU-03: el autor no puede votar su propio reporte y no se computa nada', async () => {
    const { deps, votos } = escenario();
    const delAutor = { ...entrada(0), idVotante: AUTOR };

    await expect(new ConfirmarReporte(deps).ejecutar(delAutor)).rejects.toMatchObject({
      tipo: 'PROHIBIDO',
      codigo: 'AUTOR_NO_PUEDE_VOTAR',
    });
    expect(votos.filas).toEqual([]);
  });

  it('HU-03: un solo votante con reputación 4.0 no basta para confirmar', async () => {
    const { deps, votos, conReputacion } = escenario();
    await conReputacion(usuario(1), 4.0);

    const resultado = await new ConfirmarReporte(deps).ejecutar(entrada(1));

    expect(resultado).toEqual({ peso: 4, decision: 'NINGUNA' });
    expect(votos.filas).toHaveLength(1);
  });

  it('HU-03: el segundo voto del mismo usuario se rechaza', async () => {
    const { deps } = escenario();
    await new ConfirmarReporte(deps).ejecutar(entrada(1));

    await expect(new NegarReporte(deps).ejecutar(entrada(1))).rejects.toMatchObject({
      tipo: 'CONFLICTO',
      codigo: 'YA_VOTO',
    });
  });

  it('HU-03: quien está a más de 1000 m no puede votar', async () => {
    const { deps } = escenario();

    await expect(
      new ConfirmarReporte(deps).ejecutar(entrada(1, aMetros(1200))),
    ).rejects.toMatchObject({ tipo: 'PROHIBIDO', codigo: 'DEMASIADO_LEJOS_PARA_VOTAR' });
  });

  it('HU-03: con una extensión y 5.0 confirmado, la confirmación que llega a 6.0 decide EXTENDER', async () => {
    const { deps, conVotos } = escenario(reporte({ estado: 'CONFIRMADO', extensiones: 1 }));
    conVotos([1, 'CONFIRMACION', 2.5], [2, 'CONFIRMACION', 2.5]);

    expect((await new ConfirmarReporte(deps).ejecutar(entrada(3))).decision).toBe('EXTENDER');
  });

  it('HU-03: con las dos extensiones aplicadas, ninguna confirmación extiende más', async () => {
    const { deps, conVotos } = escenario(reporte({ estado: 'CONFIRMADO', extensiones: 2 }));
    conVotos([1, 'CONFIRMACION', 5], [2, 'CONFIRMACION', 5]);

    expect((await new ConfirmarReporte(deps).ejecutar(entrada(3))).decision).toBe('NINGUNA');
  });

  it('un reporte que ya no está vigente no admite votos', async () => {
    const { deps } = escenario(reporte({ estado: 'CADUCADO' }));

    await expect(new ConfirmarReporte(deps).ejecutar(entrada(1))).rejects.toMatchObject({
      tipo: 'CONFLICTO',
      codigo: 'REPORTE_NO_ACTIVO',
    });
  });

  it('un reporte inexistente da NO_ENCONTRADO', async () => {
    const { deps } = escenario();
    const otro = { ...entrada(1), idReporte: '7a2d3e1f-4c8b-4e3b-8d69-1b5a6c2e3f40' };

    await expect(new ConfirmarReporte(deps).ejecutar(otro)).rejects.toMatchObject({
      tipo: 'NO_ENCONTRADO',
    });
  });

  it('una posición fuera del área de servicio es un error de validación', async () => {
    const { deps } = escenario();
    const fuera = { ...entrada(1), latitud: -17.39, longitud: -66.16 };

    await expect(new ConfirmarReporte(deps).ejecutar(fuera)).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
    });
  });

  it('SRS 3.2.7: el voto de un silenciado se registra con peso 0', async () => {
    const { deps, conReputacion } = escenario();
    await conReputacion(usuario(1), 0);

    expect(await new ConfirmarReporte(deps).ejecutar(entrada(1))).toEqual({
      peso: 0,
      decision: 'NINGUNA',
    });
  });

  it('SRS 3.2.7: un silenciado que cumplió 30 días vota ya recuperado y se guarda', async () => {
    const { deps, reloj, reputaciones, conReputacion } = escenario();
    await conReputacion(usuario(1), 0, new Date(reloj.ahora().getTime() - 31 * 86_400_000));

    const resultado = await new ConfirmarReporte(deps).ejecutar(entrada(1));

    expect(resultado.peso).toBe(0.5);
    expect(reputaciones.puntaje(usuario(1))).toBe(0.5);
  });

  it('SRS 3.3: el voto 31 en 10 minutos se rechaza', async () => {
    const { deps, reloj } = escenario();
    const votar = new ConfirmarReporte(deps);
    // Cada intento consume cupo, aunque después lo rechace otra regla (aquí, el voto repetido).
    for (let i = 0; i < LIMITE_DE_VOTOS.cantidad; i += 1) {
      await votar.ejecutar(entrada(5)).catch(() => undefined);
    }
    reloj.avanzarMinutos(1);

    await expect(votar.ejecutar(entrada(5))).rejects.toMatchObject({ tipo: 'LIMITE_EXCEDIDO' });
  });

  it('rechaza una entrada mal formada', async () => {
    const { deps } = escenario();

    await expect(
      new ConfirmarReporte(deps).ejecutar({ ...entrada(1), idReporte: 'x' }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA', codigo: 'ENTRADA_INVALIDA' });
  });
});

describe('RegistrarConfirmacionPorDuplicado', () => {
  const duplicado = (n: number, punto = cerca) =>
    crearEvento(
      reporteDuplicadoDetectadoV1,
      {
        idReporteExistente: ID_REPORTE,
        idReportante: usuario(n),
        ubicacionReportante: { latitud: punto.latitud, longitud: punto.longitud },
      },
      { id: '00000000-0000-4000-8000-0000000000aa', ocurridoEn: new Date() },
    );

  it('HU-01: el reporte duplicado cuenta como una confirmación de quien lo envió', async () => {
    const { deps, votos, unidadDeTrabajo } = escenario();

    await new RegistrarConfirmacionPorDuplicado(deps).manejar(duplicado(7));

    expect(votos.filas).toMatchObject([{ idVotante: usuario(7), valor: 'CONFIRMACION' }]);
    expect(unidadDeTrabajo.eventos).toHaveLength(1);
  });

  it('es idempotente: el mismo evento dos veces deja un solo voto', async () => {
    const { deps, votos } = escenario();
    const manejador = new RegistrarConfirmacionPorDuplicado(deps);

    await manejador.manejar(duplicado(7));
    await manejador.manejar(duplicado(7));

    expect(votos.filas).toHaveLength(1);
  });

  it('descarta en silencio un voto que no procede', async () => {
    const { deps, votos } = escenario(reporte({ estado: 'RESUELTO' }));

    await expect(
      new RegistrarConfirmacionPorDuplicado(deps).manejar(duplicado(7)),
    ).resolves.toBeUndefined();
    expect(votos.filas).toEqual([]);
  });

  it('propaga un error inesperado', async () => {
    const { deps } = escenario();
    const votos = new VotosEnMemoria();
    votos.existe = () => Promise.reject(new Error('sin conexión'));
    const conFallo = { ...deps, votos };

    await expect(
      new RegistrarConfirmacionPorDuplicado(conFallo).manejar(duplicado(7)),
    ).rejects.toThrow('sin conexión');
  });
});

describe('AjustarReputacionPorDesenlace', () => {
  const sobre = { id: '00000000-0000-4000-8000-0000000000bb', ocurridoEn: new Date() };

  it('HU-03: al confirmarse, el autor gana 0.20 y quienes confirmaron 0.05', async () => {
    const { deps, reputaciones, conVotos } = escenario();
    conVotos(
      [1, 'CONFIRMACION', 2],
      [2, 'CONFIRMACION', 1],
      [3, 'NEGACION', 1],
      [4, 'CONFIRMACION', 0],
    );

    await new AjustarReputacionPorDesenlace(deps).manejar(
      crearEvento(
        reporteConfirmadoV1,
        { idReporte: ID_REPORTE, caducaEn: sobre.ocurridoEn.toISOString() },
        sobre,
      ),
    );

    expect(reputaciones.puntaje(AUTOR)).toBe(1.2);
    expect(reputaciones.puntaje(usuario(1))).toBe(1.05);
    expect(reputaciones.puntaje(usuario(2))).toBe(1.05);
    expect(reputaciones.puntaje(usuario(3))).toBeUndefined();
    // Los votos de peso 0 no se premian.
    expect(reputaciones.puntaje(usuario(4))).toBeUndefined();
  });

  it('HU-03: al resolverse, quienes negaron ganan 0.05 y el autor no cambia', async () => {
    const { deps, reputaciones, conVotos } = escenario();
    conVotos([1, 'NEGACION', 1], [2, 'CONFIRMACION', 1]);

    await new AjustarReputacionPorDesenlace(deps).manejar(
      crearEvento(reporteResueltoV1, { idReporte: ID_REPORTE }, sobre),
    );

    expect(reputaciones.puntaje(usuario(1))).toBe(1.05);
    expect(reputaciones.puntaje(usuario(2))).toBeUndefined();
    expect(reputaciones.puntaje(AUTOR)).toBeUndefined();
  });

  it('HU-12: el rechazo por moderación resta 0.50 al autor', async () => {
    const { deps, reputaciones } = escenario();

    await new AjustarReputacionPorDesenlace(deps).manejar(
      crearEvento(reporteRechazadoV1, { idReporte: ID_REPORTE, motivo: 'MODERACION' }, sobre),
    );

    expect(reputaciones.puntaje(AUTOR)).toBe(0.5);
  });

  it('SRS 3.2.7: el rechazo por autor silenciado no vuelve a penalizar', async () => {
    const { deps, reputaciones } = escenario();

    await new AjustarReputacionPorDesenlace(deps).manejar(
      crearEvento(reporteRechazadoV1, { idReporte: ID_REPORTE, motivo: 'AUTOR_SILENCIADO' }, sobre),
    );

    expect(reputaciones.puntaje(AUTOR)).toBeUndefined();
  });

  it('sin el reporte no ajusta al autor, pero sí a los votantes', async () => {
    const { deps, reputaciones, conVotos } = escenario();
    deps.consultaDeReporte.reportes.clear();
    conVotos([1, 'CONFIRMACION', 1]);
    const manejador = new AjustarReputacionPorDesenlace(deps);

    await manejador.manejar(
      crearEvento(
        reporteConfirmadoV1,
        { idReporte: ID_REPORTE, caducaEn: sobre.ocurridoEn.toISOString() },
        sobre,
      ),
    );
    await manejador.manejar(
      crearEvento(reporteRechazadoV1, { idReporte: ID_REPORTE, motivo: 'MODERACION' }, sobre),
    );

    expect(reputaciones.puntaje(usuario(1))).toBe(1.05);
    expect(reputaciones.puntaje(AUTOR)).toBeUndefined();
  });

  it('escucha los tres desenlaces y rechaza cualquier otro evento', async () => {
    const { deps } = escenario();

    expect(AjustarReputacionPorDesenlace.eventos).toEqual([
      'ReporteConfirmado.v1',
      'ReporteResuelto.v1',
      'ReporteRechazado.v1',
    ]);
    await expect(
      new AjustarReputacionPorDesenlace(deps).manejar(
        crearEvento(reporteCaducadoV1, { idReporte: ID_REPORTE }, sobre),
      ),
    ).rejects.toThrow('no maneja ReporteCaducado.v1');
  });
});
