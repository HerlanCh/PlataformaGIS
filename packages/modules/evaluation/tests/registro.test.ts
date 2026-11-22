import {
  crearEvento,
  envioDuplicadoRegistradoV1,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteCreadoV1,
  reporteCreadoV2,
  reporteExtendidoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  reporteDuplicadoDetectadoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import { describe, expect, it } from 'vitest';
import { ConsultarEstadoDelRegistro } from '../application/consultar-estado-del-registro.js';
import { RegistrarEventoDeEvaluacion } from '../application/registrar-evento-de-evaluacion.js';
import { RegistroEnMemoria } from './dobles.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const REPORTE = id(1);
const VOTANTE = id(90);
const base = new Date('2026-11-22T12:00:00.000Z');
const minutos = (n: number) => new Date(base.getTime() + n * 60_000);
const iso = (n: number) => minutos(n).toISOString();
const punto = { latitud: -16.5, longitud: -68.15 };

let secuencia = 100;
const sobre = (n: number) => ({ id: id((secuencia += 1)), ocurridoEn: minutos(n) });

const creado = (fuenteOficial: 'TRANSITO' | null = null) =>
  crearEvento(
    reporteCreadoV2,
    {
      idReporte: REPORTE,
      codigoCategoria: 'bloqueo',
      publicLocation: punto,
      estado: 'ACTIVO',
      creadoEn: iso(0),
      caducaEn: iso(360),
      fuenteOficial,
    },
    sobre(0),
  );

function escenario() {
  const registro = new RegistroEnMemoria();
  const manejador = new RegistrarEventoDeEvaluacion(registro);
  const manejar = async (...eventos: EventoDeIntegracion[]) => {
    for (const evento of eventos) await manejador.manejar(evento);
  };
  return { registro, manejar };
}

describe('RegistrarEventoDeEvaluacion', () => {
  it('HU-14: un reporte creado es un envío CREADO y su primera transición, ACTIVO', async () => {
    const { registro, manejar } = escenario();

    await manejar(creado());

    expect([...registro.envios.values()]).toEqual([
      {
        idEnvio: REPORTE,
        tipo: 'CREADO',
        idReporte: REPORTE,
        codigoCategoria: 'bloqueo',
        publicLocation: punto,
        fuenteOficial: null,
        recibidoEn: minutos(0),
      },
    ]);
    expect([...registro.transiciones.values()]).toEqual([
      expect.objectContaining({ estado: 'ACTIVO', caducaEn: minutos(360), ocurridoEn: minutos(0) }),
    ]);
  });

  it('HU-14: acepta ReporteCreado.v1 como reporte de la comunidad y guarda la fuente oficial de la v2', async () => {
    const { registro, manejar } = escenario();
    const v1 = crearEvento(
      reporteCreadoV1,
      {
        idReporte: id(2),
        codigoCategoria: 'accidente',
        publicLocation: punto,
        estado: 'ACTIVO',
        creadoEn: iso(0),
        caducaEn: iso(180),
      },
      sobre(0),
    );

    await manejar(v1, creado('TRANSITO'));

    expect(registro.envios.get(id(2))?.fuenteOficial).toBeNull();
    expect(registro.envios.get(REPORTE)?.fuenteOficial).toBe('TRANSITO');
  });

  it('HU-14: un duplicado es un envío propio que apunta al reporte que lo absorbió', async () => {
    const { registro, manejar } = escenario();
    const envio = crearEvento(
      envioDuplicadoRegistradoV1,
      {
        idEnvio: id(3),
        idReporteExistente: REPORTE,
        codigoCategoria: 'bloqueo',
        publicLocation: { latitud: -16.5004, longitud: -68.15 },
        recibidoEn: iso(5),
      },
      sobre(5),
    );

    await manejar(envio);

    expect(registro.envios.get(id(3))).toEqual({
      idEnvio: id(3),
      tipo: 'DUPLICADO',
      idReporte: REPORTE,
      codigoCategoria: 'bloqueo',
      publicLocation: { latitud: -16.5004, longitud: -68.15 },
      fuenteOficial: null,
      recibidoEn: minutos(5),
    });
    expect(registro.transiciones.size).toBe(0);
  });

  it('HU-14: confirmación y extensión dejan CONFIRMADO con su caducidad; los cierres, sin caducidad', async () => {
    const { registro, manejar } = escenario();

    await manejar(
      creado(),
      crearEvento(reporteConfirmadoV1, { idReporte: REPORTE, caducaEn: iso(540) }, sobre(10)),
      crearEvento(reporteExtendidoV1, { idReporte: REPORTE, caducaEn: iso(720) }, sobre(20)),
      crearEvento(reporteResueltoV1, { idReporte: REPORTE }, sobre(30)),
      crearEvento(reporteCaducadoV1, { idReporte: REPORTE }, sobre(40)),
      crearEvento(reporteRechazadoV1, { idReporte: REPORTE, motivo: 'MODERACION' }, sobre(50)),
    );

    const cambios = [...registro.transiciones.values()].map((t) => [
      t.estado,
      t.caducaEn,
      t.ocurridoEn,
    ]);
    expect(cambios).toEqual([
      ['ACTIVO', minutos(360), minutos(0)],
      ['CONFIRMADO', minutos(540), minutos(10)],
      ['CONFIRMADO', minutos(720), minutos(20)],
      ['RESUELTO', null, minutos(30)],
      ['CADUCADO', null, minutos(40)],
      ['RECHAZADO', null, minutos(50)],
    ]);
  });

  it('HU-14: de un voto guarda peso, valor y decisión, nunca quién votó', async () => {
    const { registro, manejar } = escenario();
    const voto = crearEvento(
      votoEmitidoV1,
      {
        idReporte: REPORTE,
        idVotante: VOTANTE,
        valor: 'CONFIRMACION',
        peso: 1.2,
        decision: 'NINGUNA',
      },
      sobre(7),
    );

    await manejar(voto);

    const guardado = registro.votos.get(voto.id)!;
    expect(guardado).toEqual({
      idEvento: voto.id,
      idReporte: REPORTE,
      valor: 'CONFIRMACION',
      peso: 1.2,
      decision: 'NINGUNA',
      ocurridoEn: minutos(7),
    });
    expect(JSON.stringify(guardado)).not.toContain(VOTANTE);
  });

  it('HU-14: un evento repetido no se registra dos veces e ignora los que no escucha', async () => {
    const { registro, manejar } = escenario();
    const evento = creado();
    const ajeno = crearEvento(
      reporteDuplicadoDetectadoV1,
      { idReporteExistente: REPORTE, idReportante: VOTANTE, ubicacionReportante: punto },
      sobre(1),
    );

    await manejar(evento, evento, ajeno);

    expect(registro.envios.size).toBe(1);
    expect(registro.transiciones.size).toBe(1);
  });

  it('se suscribe a todos los eventos que necesita para reconstruir las vistas', () => {
    expect(RegistrarEventoDeEvaluacion.eventos).toEqual([
      'ReporteCreado.v1',
      'ReporteCreado.v2',
      'EnvioDuplicadoRegistrado.v1',
      'ReporteConfirmado.v1',
      'ReporteExtendido.v1',
      'ReporteResuelto.v1',
      'ReporteCaducado.v1',
      'ReporteRechazado.v1',
      'VotoEmitido.v1',
    ]);
  });
});

describe('ConsultarEstadoDelRegistro', () => {
  it('HU-14: un ciudadano no puede consultarlo', async () => {
    const consultar = new ConsultarEstadoDelRegistro(new RegistroEnMemoria());

    await expect(consultar.ejecutar({ rolActor: 'CIUDADANO' })).rejects.toMatchObject({
      tipo: 'PROHIBIDO',
      codigo: 'ROL_INSUFICIENTE',
    });
  });

  it('HU-14: un moderador ve cuántos envíos hay y cuándo llegó el último', async () => {
    const { registro, manejar } = escenario();
    const consultar = new ConsultarEstadoDelRegistro(registro);
    expect(await consultar.ejecutar({ rolActor: 'MODERADOR' })).toEqual({
      enviosRegistrados: 0,
      ultimoEnvioEn: null,
    });

    await manejar(creado());

    expect(await consultar.ejecutar({ rolActor: 'MODERADOR' })).toEqual({
      enviosRegistrados: 1,
      ultimoEnvioEn: minutos(0),
    });
  });
});
