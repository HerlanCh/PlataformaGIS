import { idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { desplazar, GeneradorDeIdSecuencial, LimitadorEnMemoria, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { CrearReporte, LIMITE_DE_REPORTES } from '../application/crear-reporte.js';
import type { EntradaCrearReporte } from '../application/crear-reporte.js';
import type { UnidadDeTrabajoDeReporte } from '../application/ports.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import { Reporte } from '../domain/report.js';
import {
  CategoriasEnMemoria,
  RepositorioReportesEnMemoria,
  ReputacionFalsa,
  UnidadDeTrabajoEnMemoria,
} from './dobles.js';

const ANA = idUsuario('11111111-1111-4111-8111-111111111111');
const BETO = idUsuario('22222222-2222-4222-8222-222222222222');
const laPaz = PuntoGeo.crear(-16.5, -68.15);

function escenario() {
  const reportes = new RepositorioReportesEnMemoria();
  const unidad = new UnidadDeTrabajoEnMemoria(reportes);
  const reloj = new RelojFijo();
  const reputacion = new ReputacionFalsa();
  const deps = {
    reportes,
    categorias: new CategoriasEnMemoria(),
    unidadDeTrabajo: unidad,
    reputacion,
    limitador: new LimitadorEnMemoria(reloj),
    reloj,
    ids: new GeneradorDeIdSecuencial(),
  };
  return { reportes, unidad, reloj, reputacion, deps, crear: new CrearReporte(deps) };
}

let clave = 0;
const entrada = (
  autor = ANA,
  punto = laPaz,
  categoria = 'bloqueo',
  idempotencyKey = `clave-${String((clave += 1)).padStart(6, '0')}`,
): EntradaCrearReporte => ({
  idAutor: autor,
  codigoCategoria: categoria,
  latitud: punto.latitud,
  longitud: punto.longitud,
  idempotencyKey,
});

describe('CrearReporte', () => {
  it('HU-01: crea un reporte ACTIVO con caducidad a 360 minutos y emite ReporteCreado', async () => {
    const { crear, reportes, unidad, reloj } = escenario();

    const salida = await crear.ejecutar(entrada());

    expect(salida.resultado).toBe('CREADO');
    expect(salida.reporte).toMatchObject({ codigoCategoria: 'bloqueo', estado: 'ACTIVO' });
    expect(salida.reporte.caducaEn.getTime() - reloj.ahora().getTime()).toBe(360 * 60_000);
    expect(reportes.todos()).toHaveLength(1);
    expect(unidad.tipos()).toEqual(['ReporteCreado']);
  });

  it('HU-02: ni la respuesta ni el evento llevan la ubicación real ni el autor', async () => {
    const { crear, unidad } = escenario();

    const salida = await crear.ejecutar(entrada(ANA, laPaz, 'robo'));

    expect(salida.reporte).not.toHaveProperty('location');
    expect(salida.reporte).not.toHaveProperty('authorId');
    expect(salida.reporte.publicLocation.esIgualA(laPaz)).toBe(false);
    const contenido = unidad.eventos[0]!.contenido as Record<string, unknown>;
    expect(Object.keys(contenido)).not.toContain('location');
    expect(Object.keys(contenido)).not.toContain('authorId');
  });

  it('HU-01: un reporte de otro usuario a 40 m cuenta como confirmación y no se duplica', async () => {
    const { crear, reportes, unidad } = escenario();
    const original = await crear.ejecutar(entrada(ANA));
    const cercano = desplazar(laPaz, 40, 0);

    const salida = await crear.ejecutar(entrada(BETO, cercano));

    expect(salida).toEqual({ resultado: 'DUPLICADO', reporte: original.reporte });
    expect(reportes.todos()).toHaveLength(1);
    const duplicado = unidad.eventos.at(-1)!;
    expect(duplicado).toMatchObject({
      tipo: 'ReporteDuplicadoDetectado',
      contenido: {
        idReporteExistente: original.reporte.id,
        idReportante: BETO,
        ubicacionReportante: { latitud: cercano.latitud, longitud: cercano.longitud },
      },
    });
  });

  it('HU-01: fuera del radio de deduplicación o de otra categoría se crea otro reporte', async () => {
    const { crear, reportes } = escenario();
    await crear.ejecutar(entrada(ANA));

    const lejos = await crear.ejecutar(entrada(BETO, desplazar(laPaz, 300, 0)));
    const otraCategoria = await crear.ejecutar(entrada(BETO, laPaz, 'accidente'));

    expect([lejos.resultado, otraCategoria.resultado]).toEqual(['CREADO', 'CREADO']);
    expect(reportes.todos()).toHaveLength(3);
  });

  it('HU-01: fuera de La Paz y El Alto se rechaza la creación', async () => {
    const { crear, reportes } = escenario();
    const cochabamba = { ...entrada(), latitud: -17.39, longitud: -66.16 };

    await expect(crear.ejecutar(cochabamba)).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
      codigo: 'FUERA_DEL_AREA_DE_SERVICIO',
    });
    expect(reportes.todos()).toHaveLength(0);
  });

  it('HU-01: el duplicado de mi propio reporte no crea otro ni registra voto', async () => {
    const { crear, reportes, unidad } = escenario();
    const original = await crear.ejecutar(entrada(ANA));

    const salida = await crear.ejecutar(entrada(ANA, desplazar(laPaz, 40, 0)));

    expect(salida).toEqual({ resultado: 'PROPIO_EXISTENTE', reporte: original.reporte });
    expect(reportes.todos()).toHaveLength(1);
    expect(unidad.tipos()).toEqual(['ReporteCreado']);
  });

  it('HU-01: el sexto reporte en 10 minutos se rechaza indicando cuánto esperar', async () => {
    const { crear, reloj } = escenario();
    for (let i = 0; i < LIMITE_DE_REPORTES.cantidad; i += 1) {
      await crear.ejecutar(entrada(ANA, desplazar(laPaz, i * 500, 0)));
      reloj.avanzarMinutos(1);
    }

    const sexto = crear.ejecutar(entrada(ANA, desplazar(laPaz, 0, 3000)));

    await expect(sexto).rejects.toMatchObject({
      tipo: 'LIMITE_EXCEDIDO',
      reintentarEnSegundos: 5 * 60,
    });
  });

  it('HU-05: el reenvío con la misma clave devuelve el resultado original sin crear otro', async () => {
    const { crear, reportes, unidad } = escenario();
    const envio = entrada(ANA, laPaz, 'bloqueo', 'offline-0001');
    const primero = await crear.ejecutar(envio);

    const reenvio = await crear.ejecutar(envio);

    expect(reenvio).toEqual(primero);
    expect(reportes.todos()).toHaveLength(1);
    expect(unidad.eventos).toHaveLength(1);
  });

  it('HU-05: el reenvío no consume el cupo de creación', async () => {
    const { crear } = escenario();
    const envio = entrada(ANA, laPaz, 'bloqueo', 'offline-0002');
    await crear.ejecutar(envio);

    for (let i = 0; i < LIMITE_DE_REPORTES.cantidad + 2; i += 1) {
      await expect(crear.ejecutar(envio)).resolves.toMatchObject({ resultado: 'CREADO' });
    }
  });

  it('una clave de idempotencia que ya usó otro usuario es un conflicto', async () => {
    const { crear } = escenario();
    await crear.ejecutar(entrada(ANA, laPaz, 'bloqueo', 'compartida-01'));

    await expect(
      crear.ejecutar(entrada(BETO, desplazar(laPaz, 900, 0), 'bloqueo', 'compartida-01')),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'CLAVE_DE_IDEMPOTENCIA_AJENA' });
  });

  it('HU-05: si otro envío simultáneo ganó la carrera, devuelve el reporte ganador', async () => {
    const { deps, reportes, reloj } = escenario();
    const ganador = Reporte.crear({
      id: idReporte('99999999-9999-4999-8999-999999999999'),
      categoria: CATEGORIAS_MVP[0]!,
      authorId: ANA,
      location: laPaz,
      idempotencyKey: 'carrera-0001',
      ahora: reloj.ahora(),
    });
    // Entre la consulta de la clave y el guardado, otro proceso guarda el mismo reporte.
    const unidadConCarrera: UnidadDeTrabajoDeReporte = {
      confirmar: async (reporte, eventos) => {
        await reportes.guardar(ganador);
        await deps.unidadDeTrabajo.confirmar(reporte, eventos);
      },
      registrarEventos: (eventos) => deps.unidadDeTrabajo.registrarEventos(eventos),
    };
    const crear = new CrearReporte({ ...deps, unidadDeTrabajo: unidadConCarrera });

    const salida = await crear.ejecutar(entrada(ANA, laPaz, 'bloqueo', 'carrera-0001'));

    expect(salida.resultado).toBe('CREADO');
    expect(salida.reporte.id).toBe(ganador.id);
    expect(reportes.todos()).toHaveLength(1);
  });

  it('SRS 3.2.7: el reporte de un silenciado se guarda rechazado, sin eventos y sin aviso', async () => {
    const { crear, reportes, unidad, reputacion } = escenario();
    reputacion.silenciados.add(ANA);
    const envio = entrada(ANA);

    const salida = await crear.ejecutar(envio);

    expect(salida.resultado).toBe('CREADO');
    expect(salida.reporte.estado).toBe('ACTIVO');
    expect(reportes.todos()[0]).toMatchObject({
      estado: 'RECHAZADO',
      motivoRechazo: 'AUTOR_SILENCIADO',
    });
    expect(unidad.eventos).toEqual([]);
    // Tampoco el reenvío le revela el rechazo.
    expect((await crear.ejecutar(envio)).reporte.estado).toBe('ACTIVO');
  });

  it.each([
    ['una categoría inexistente', { codigoCategoria: 'ovni' }, 'CATEGORIA_DESCONOCIDA'],
    ['una categoría mal escrita', { codigoCategoria: 'Bloqueo!' }, 'ENTRADA_INVALIDA'],
    ['una clave de idempotencia corta', { idempotencyKey: 'abc' }, 'ENTRADA_INVALIDA'],
    ['un autor que no es UUID', { idAutor: 'ana' }, 'ENTRADA_INVALIDA'],
  ])('rechaza %s como error de validación', async (_caso, cambio, codigo) => {
    const { crear } = escenario();

    await expect(crear.ejecutar({ ...entrada(), ...cambio })).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
      codigo,
    });
  });
});
