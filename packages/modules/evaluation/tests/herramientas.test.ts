import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import {
  GuardarEtiquetas,
  ListarEnviosParaEtiquetar,
  MedirAcuerdo,
} from '../application/etiquetado.js';
import { FijarClave } from '../application/instantaneas.js';
import { CrearSesion, IniciarTarea, ListarSesiones, TerminarTarea } from '../application/tareas.js';
import {
  ListarVerificaciones,
  RegistrarVerificacion,
  SortearReportes,
} from '../application/verificacion.js';
import type { Instantanea } from '../domain/instantanea.js';
import {
  EtiquetasEnMemoria,
  InstantaneasEnMemoria,
  RegistroEnMemoria,
  SesionesEnMemoria,
  VerificacionesEnMemoria,
} from './dobles.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const MODERADOR = 'MODERADOR' as const;
const CIUDADANO = 'CIUDADANO' as const;
const punto = { latitud: -16.5, longitud: -68.15 };
const caja = { latitudMin: -16.51, latitudMax: -16.49, longitudMin: -68.16, longitudMax: -68.14 };

function instantanea(n: number, nombre: string, clave: string[] = ['g1']): Instantanea {
  const base = { codigoCategoria: 'bloqueo', publicLocation: punto, fuenteOficial: null };
  return {
    id: id(n),
    nombre,
    instante: new Date('2026-11-20T12:00:00.000Z'),
    caja,
    creadaEn: new Date('2026-11-21T12:00:00.000Z'),
    clave,
    procesada: [
      {
        ...base,
        idReporte: id(10),
        estado: 'ACTIVO',
        caducaEn: new Date('2026-11-20T18:00:00.000Z'),
      },
    ],
    base: [
      {
        ...base,
        idEnvio: id(10),
        idReporte: id(10),
        recibidoEn: new Date('2026-11-20T11:00:00.000Z'),
      },
      {
        ...base,
        idEnvio: id(11),
        idReporte: id(10),
        recibidoEn: new Date('2026-11-20T11:05:00.000Z'),
      },
    ],
  };
}

async function tareas(conInstantaneas = true, clave = ['g1']) {
  const reloj = new RelojFijo('2026-11-22T12:00:00.000Z');
  const instantaneas = new InstantaneasEnMemoria();
  if (conInstantaneas) {
    await instantaneas.guardar(instantanea(1, 'E1', clave));
    await instantaneas.guardar(instantanea(2, 'E2', clave));
  }
  const sesiones = new SesionesEnMemoria();
  const ids = new GeneradorDeIdSecuencial('bbbbbbbb');
  // Con azar 0 se elige siempre la primera de las secuencias empatadas.
  const deps = { sesiones, instantaneas, reloj, ids, azar: () => 0 };
  return {
    reloj,
    instantaneas,
    fijar: new FijarClave({ instantaneas, sesiones }),
    crear: new CrearSesion(deps),
    listar: new ListarSesiones(sesiones),
    iniciar: new IniciarTarea(deps),
    terminar: new TerminarTarea(deps),
  };
}

describe('clave y secuencias (perfil v5, 6.3)', () => {
  it('HU-14: sin secuencia se sortea entre las que llevan menos sesiones, y quedan equilibradas', async () => {
    const { crear } = await tareas();
    const secuencias: number[] = [];

    for (let n = 1; n <= 8; n += 1) {
      const codigoParticipante = `P${String(n).padStart(2, '0')}`;
      secuencias.push(
        (await crear.ejecutar({ rolActor: MODERADOR, codigoParticipante })).secuencia,
      );
    }

    expect(secuencias).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it('HU-14: no hay sesiones hasta que los evaluadores fijan la clave de E1 y E2', async () => {
    const { crear } = await tareas(true, []);

    await expect(
      crear.ejecutar({ rolActor: MODERADOR, codigoParticipante: 'P01', secuencia: 1 }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'FALTA_CLAVE' });
  });

  it('HU-14: la clave se reemplaza sin repetir grupos y no cambia después de la primera tarea', async () => {
    const { crear, fijar, iniciar, instantaneas } = await tareas(true, []);
    await fijar.ejecutar({ rolActor: MODERADOR, id: id(2), grupos: ['g9'] });

    const fijada = await fijar.ejecutar({
      rolActor: MODERADOR,
      id: id(1),
      grupos: [' g1 ', 'g2', 'g1'],
    });
    const sesion = await crear.ejecutar({
      rolActor: MODERADOR,
      codigoParticipante: 'P01',
      secuencia: 1,
    });
    await iniciar.ejecutar({ rolActor: MODERADOR, idTarea: sesion.tareas[0].id });

    expect(fijada.clave).toEqual(['g1', 'g2']);
    expect((await instantaneas.buscarPorId(id(1)))?.clave).toEqual(['g1', 'g2']);
    await expect(
      fijar.ejecutar({ rolActor: MODERADOR, id: id(1), grupos: ['g3'] }),
    ).rejects.toMatchObject({
      codigo: 'CLAVE_EN_USO',
    });
    await expect(
      fijar.ejecutar({ rolActor: MODERADOR, id: id(99), grupos: [] }),
    ).rejects.toMatchObject({
      codigo: 'INSTANTANEA_NO_ENCONTRADA',
    });
    await expect(
      fijar.ejecutar({ rolActor: CIUDADANO, id: id(2), grupos: [] }),
    ).rejects.toMatchObject({
      codigo: 'ROL_INSUFICIENTE',
    });
  });
});

describe('tarea cronometrada (ADR-007)', () => {
  it('HU-14: crea la sesión con la secuencia asignada sobre E1 y E2', async () => {
    const { crear, listar } = await tareas();

    const sesion = await crear.ejecutar({
      rolActor: MODERADOR,
      codigoParticipante: ' p07 ',
      secuencia: 3,
    });

    expect(sesion.codigoParticipante).toBe('P07');
    expect(sesion.tareas.map((t) => [t.orden, t.vista, t.escenario, t.idInstantanea])).toEqual([
      [1, 'BASE', 'E2', id(2)],
      [2, 'PROCESADA', 'E1', id(1)],
    ]);
    expect(await listar.ejecutar({ rolActor: MODERADOR })).toEqual([sesion]);
  });

  it('HU-14: rechaza nombres como código, participantes repetidos y sesiones sin E1 y E2', async () => {
    const { crear } = await tareas();
    const sinInstantaneas = (await tareas(false)).crear;
    await crear.ejecutar({ rolActor: MODERADOR, codigoParticipante: 'P01', secuencia: 1 });

    await expect(
      crear.ejecutar({ rolActor: MODERADOR, codigoParticipante: 'Ana', secuencia: 1 }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
    await expect(
      crear.ejecutar({ rolActor: MODERADOR, codigoParticipante: 'P01', secuencia: 2 }),
    ).rejects.toMatchObject({ codigo: 'PARTICIPANTE_REPETIDO' });
    await expect(
      sinInstantaneas.ejecutar({ rolActor: MODERADOR, codigoParticipante: 'P02', secuencia: 1 }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'FALTAN_INSTANTANEAS' });
  });

  it('HU-14: la tarea muestra solo los puntos de su vista y se cierra con las marcas válidas', async () => {
    const { crear, iniciar, terminar, reloj } = await tareas();
    const sesion = await crear.ejecutar({
      rolActor: MODERADOR,
      codigoParticipante: 'P03',
      secuencia: 1,
    });
    const [primera, segunda] = sesion.tareas;

    await expect(
      iniciar.ejecutar({ rolActor: MODERADOR, idTarea: segunda.id }),
    ).rejects.toMatchObject({
      codigo: 'TAREA_ANTERIOR_PENDIENTE',
    });
    const enCurso = await iniciar.ejecutar({ rolActor: MODERADOR, idTarea: primera.id });
    await expect(
      iniciar.ejecutar({ rolActor: MODERADOR, idTarea: primera.id }),
    ).rejects.toMatchObject({
      codigo: 'TAREA_YA_INICIADA',
    });
    reloj.avanzarMinutos(1);
    const cerrada = await terminar.ejecutar({
      rolActor: MODERADOR,
      idTarea: primera.id,
      marcas: [
        { idPunto: id(11), msDesdeInicio: 12_000 },
        { idPunto: id(99), msDesdeInicio: 15_000 },
      ],
    });

    // Secuencia 1: primero la vista base de E1, con sus dos envíos como puntos propios.
    expect(enCurso.puntos).toHaveLength(2);
    expect(enCurso.caja).toEqual(caja);
    expect(cerrada).toMatchObject({ duracionMs: 60_000, agotada: false });
    expect(cerrada.marcas).toEqual([{ idPunto: id(11), msDesdeInicio: 12_000 }]);
    await expect(
      terminar.ejecutar({ rolActor: MODERADOR, idTarea: primera.id, marcas: [] }),
    ).rejects.toMatchObject({ codigo: 'TAREA_YA_TERMINADA' });
    const segundaEnCurso = await iniciar.ejecutar({ rolActor: MODERADOR, idTarea: segunda.id });
    expect(segundaEnCurso.puntos.map((p) => p.idReporte)).toEqual([id(10)]);
  });

  it('HU-14: no se cierra una tarea sin empezar ni se usa una que no existe', async () => {
    const { crear, terminar, iniciar } = await tareas();
    const sesion = await crear.ejecutar({
      rolActor: MODERADOR,
      codigoParticipante: 'P04',
      secuencia: 2,
    });

    await expect(
      terminar.ejecutar({ rolActor: MODERADOR, idTarea: sesion.tareas[0].id, marcas: [] }),
    ).rejects.toMatchObject({ codigo: 'TAREA_NO_INICIADA' });
    await expect(iniciar.ejecutar({ rolActor: MODERADOR, idTarea: id(500) })).rejects.toMatchObject(
      {
        tipo: 'NO_ENCONTRADO',
        codigo: 'TAREA_NO_ENCONTRADA',
      },
    );
  });

  it('HU-14: un ciudadano no usa las herramientas', async () => {
    const { crear, listar, iniciar } = await tareas();

    for (const intento of [
      crear.ejecutar({ rolActor: CIUDADANO, codigoParticipante: 'P05', secuencia: 1 }),
      listar.ejecutar({ rolActor: CIUDADANO }),
      iniciar.ejecutar({ rolActor: CIUDADANO, idTarea: id(1) }),
    ]) {
      await expect(intento).rejects.toMatchObject({ codigo: 'ROL_INSUFICIENTE' });
    }
  });
});

async function registroConEnvios() {
  const registro = new RegistroEnMemoria();
  const envio = (n: number, minuto: number, cambios = {}) =>
    registro.registrarEnvio({
      idEnvio: id(n),
      tipo: 'CREADO',
      idReporte: id(n),
      codigoCategoria: 'bloqueo',
      publicLocation: { latitud: -16.5 + n * 0.0001, longitud: -68.15 },
      fuenteOficial: null,
      recibidoEn: new Date(Date.UTC(2026, 10, 20, 12, minuto)),
      ...cambios,
    });
  await envio(1, 0);
  await envio(2, 5, { tipo: 'DUPLICADO', idReporte: id(1) });
  await envio(3, 10);
  await envio(4, 15, { fuenteOficial: 'TRANSITO' });
  await envio(5, 20);
  const transicion = (n: number, estado: 'CONFIRMADO' | 'RECHAZADO') =>
    registro.registrarTransicion({
      idEvento: id(100 + n),
      idReporte: id(n),
      estado,
      caducaEn: estado === 'CONFIRMADO' ? new Date('2026-11-21T00:00:00Z') : null,
      ocurridoEn: new Date(Date.UTC(2026, 10, 20, 13)),
    });
  await transicion(1, 'CONFIRMADO');
  await transicion(5, 'RECHAZADO');
  return registro;
}

const periodo = { desde: '2026-11-20T00:00:00.000Z', hasta: '2026-11-21T00:00:00.000Z' };

describe('etiquetado (ADR-007)', () => {
  it('HU-14: lista los envíos de la comunidad no rechazados, sin el reporte de la plataforma ni las etiquetas del otro', async () => {
    const etiquetas = new EtiquetasEnMemoria();
    const listar = new ListarEnviosParaEtiquetar(await registroConEnvios(), etiquetas);
    const guardar = new GuardarEtiquetas(etiquetas);
    await guardar.ejecutar({
      rolActor: MODERADOR,
      evaluador: 'A',
      asignaciones: [
        { idEnvio: id(1), grupo: ' x ' },
        { idEnvio: id(3), grupo: 'y' },
      ],
    });
    await guardar.ejecutar({
      rolActor: MODERADOR,
      evaluador: 'B',
      asignaciones: [{ idEnvio: id(1), grupo: 'z' }],
    });
    await guardar.ejecutar({
      rolActor: MODERADOR,
      evaluador: 'A',
      asignaciones: [{ idEnvio: id(3), grupo: null }],
    });

    const deA = await listar.ejecutar({ rolActor: MODERADOR, evaluador: 'A', periodo });
    const consenso = await listar.ejecutar({ rolActor: MODERADOR, evaluador: 'CONSENSO', periodo });

    expect(deA.envios.map((e) => e.idEnvio)).toEqual([id(1), id(2), id(3)]);
    expect(deA.envios[0]).not.toHaveProperty('idReporte');
    expect(deA.etiquetas).toEqual([{ evaluador: 'A', idEnvio: id(1), grupo: 'x' }]);
    expect(consenso.etiquetas.map((e) => e.evaluador).toSorted()).toEqual(['A', 'B']);
  });

  it('HU-14: mide el kappa con los radios que inyecta la raíz de composición', async () => {
    const etiquetas = new EtiquetasEnMemoria();
    const medir = new MedirAcuerdo(
      await registroConEnvios(),
      etiquetas,
      new Map([['bloqueo', 100]]),
    );
    for (const evaluador of ['A', 'B'] as const) {
      await new GuardarEtiquetas(etiquetas).ejecutar({
        rolActor: MODERADOR,
        evaluador,
        asignaciones: [1, 2, 3].map((n) => ({ idEnvio: id(n), grupo: n < 3 ? 'x' : 'y' })),
      });
    }

    const acuerdo = await medir.ejecutar({ rolActor: MODERADOR, periodo });

    expect(acuerdo).toMatchObject({ kappa: 1, paresEvaluados: 3, desacuerdos: [] });
    await expect(
      medir.ejecutar({
        rolActor: MODERADOR,
        periodo: { desde: periodo.hasta, hasta: periodo.desde },
      }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
  });
});

describe('verificación (ADR-007)', () => {
  it('HU-14: sortea entre los reportes de la comunidad creados en el periodo y no rechazados', async () => {
    const sorteo = await new SortearReportes(await registroConEnvios(), () => 0).ejecutar({
      rolActor: MODERADOR,
      periodo,
    });

    expect(sorteo.confirmados.map((r) => r.idReporte)).toEqual([id(1)]);
    expect(sorteo.noConfirmados.map((r) => r.idReporte)).toEqual([id(3)]);
  });

  it('HU-14: registra y corrige la verificación; solo lo real tiene hora de fin y no futura', async () => {
    const reloj = new RelojFijo('2026-11-22T12:00:00.000Z');
    const verificaciones = new VerificacionesEnMemoria();
    const registrar = new RegistrarVerificacion(verificaciones, reloj);
    const base = {
      rolActor: MODERADOR,
      idReporte: id(1),
      fuente: 'CAMPO' as const,
      detalleFuente: '  ',
    };

    await registrar.ejecutar({ ...base, resultado: 'NO_VERIFICABLE', finEn: null });
    const corregida = await registrar.ejecutar({
      ...base,
      resultado: 'REAL',
      finEn: '2026-11-20T15:30:00.000Z',
      detalleFuente: 'Visita a la esquina',
    });

    expect(
      await new ListarVerificaciones(verificaciones).ejecutar({ rolActor: MODERADOR }),
    ).toEqual([corregida]);
    expect(corregida).toMatchObject({
      resultado: 'REAL',
      finEn: new Date('2026-11-20T15:30:00.000Z'),
    });
    await expect(
      registrar.ejecutar({ ...base, resultado: 'FALSO', finEn: '2026-11-20T15:30:00.000Z' }),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
    await expect(
      registrar.ejecutar({ ...base, resultado: 'REAL', finEn: '2026-11-23T00:00:00.000Z' }),
    ).rejects.toMatchObject({ codigo: 'INSTANTE_FUTURO' });
    const primera = await registrar.ejecutar({ ...base, resultado: 'FALSO', finEn: null });
    expect(primera.detalleFuente).toBeNull();
  });
});
