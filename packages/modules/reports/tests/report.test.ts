import { PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { CATEGORIAS_MVP } from '../domain/category.js';
import type { Categoria } from '../domain/category.js';
import {
  ErrorLimiteDeExtensiones,
  ErrorTransicionInvalida,
  ErrorAunNoCaduca,
  ErrorDescripcionInvalida,
  ErrorDescripcionYaAgregada,
  ErrorNoEsElAutor,
  ErrorReporteNoVigente,
} from '../domain/errors.js';
import { FUENTES_OFICIALES, MAX_DESCRIPCION, Reporte, TRANSICIONES } from '../domain/report.js';
import type { EstadoReporte } from '../domain/report.js';

const categoria = (codigo: string): Categoria => {
  const encontrada = CATEGORIAS_MVP.find((c) => c.codigo === codigo);
  if (!encontrada) throw new Error(`categoría desconocida: ${codigo}`);
  return encontrada;
};

const creado = new Date('2026-10-11T12:00:00Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);
const laPaz = PuntoGeo.crear(-16.5, -68.15);
const autor = idUsuario('11111111-1111-4111-8111-111111111111');
const CLAVE = 'b7e2a9c4-51d3-4f6a-9e08-3c2d1a0f9b77';

const crear = (codigo = 'accidente') =>
  Reporte.crear({
    id: idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
    categoria: categoria(codigo),
    authorId: autor,
    location: laPaz,
    idempotencyKey: CLAVE,
    ahora: creado,
  });

/** Lleva un reporte nuevo al estado indicado por un camino válido. */
function enEstado(estado: EstadoReporte): Reporte {
  const reporte = crear();
  const caminos: Record<EstadoReporte, (r: Reporte) => void> = {
    ACTIVO: () => {},
    CONFIRMADO: (r) => r.marcarConfirmado(creado),
    RESUELTO: (r) => r.marcarResuelto(creado),
    CADUCADO: (r) => r.caducar(minutosDespues(181)),
    RECHAZADO: (r) => r.rechazar('MODERACION', creado),
  };
  caminos[estado](reporte);
  reporte.extraerEventos();
  return reporte;
}

/** Intenta la transición hacia `destino` con el método que le corresponde. */
const INTENTAR: Record<Exclude<EstadoReporte, 'ACTIVO'>, (r: Reporte) => void> = {
  CONFIRMADO: (r) => r.marcarConfirmado(creado),
  RESUELTO: (r) => r.marcarResuelto(creado),
  // Muy después de cualquier caducidad posible, para probar solo la máquina de estados.
  CADUCADO: (r) => r.caducar(minutosDespues(100_000)),
  RECHAZADO: (r) => r.rechazar('MODERACION', creado),
};

const ESTADOS = Object.keys(TRANSICIONES) as EstadoReporte[];
const DESTINOS = Object.keys(INTENTAR) as Exclude<EstadoReporte, 'ACTIVO'>[];
const PARES = ESTADOS.flatMap((desde) => DESTINOS.map((hacia) => [desde, hacia] as const));

describe('Reporte: creación', () => {
  it('HU-01: nace ACTIVO, con la caducidad de su categoría', () => {
    const reporte = crear('bloqueo');

    expect(reporte).toMatchObject({
      estado: 'ACTIVO',
      codigoCategoria: 'bloqueo',
      authorId: autor,
      ttlMinutos: 360,
      creadoEn: creado,
      caducaEn: minutosDespues(360),
      extensiones: 0,
      motivoRechazo: null,
      idempotencyKey: CLAVE,
      estaActivo: true,
    });
    expect(reporte.extraerEventos()).toEqual([{ tipo: 'ReporteCreado', ocurridoEn: creado }]);
  });

  it('HU-02: en una categoría no sensible la ubicación pública es la real', () => {
    expect(crear('bloqueo').publicLocation.esIgualA(laPaz)).toBe(true);
  });

  it('HU-02: en "robo" la ubicación pública no es la real, que se conserva aparte', () => {
    const reporte = crear('robo');

    expect(reporte.location.esIgualA(laPaz)).toBe(true);
    expect(reporte.publicLocation.esIgualA(laPaz)).toBe(false);
    expect(reporte.location.distanciaA(reporte.publicLocation)).toBeLessThanOrEqual(142);
  });
});

describe('Reporte: máquina de estados', () => {
  const validos = PARES.filter(([desde, hacia]) => TRANSICIONES[desde].includes(hacia));
  const invalidos = PARES.filter(([desde, hacia]) => !TRANSICIONES[desde].includes(hacia));

  it('la tabla de transiciones es la del roadmap', () => {
    expect(TRANSICIONES).toEqual({
      ACTIVO: ['CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'],
      CONFIRMADO: ['RESUELTO', 'CADUCADO', 'RECHAZADO'],
      RESUELTO: [],
      CADUCADO: [],
      RECHAZADO: [],
    });
    expect(validos).toHaveLength(7);
    expect(invalidos).toHaveLength(13);
  });

  it.each(validos)('permite %s → %s', (desde, hacia) => {
    const reporte = enEstado(desde);

    INTENTAR[hacia](reporte);

    expect(reporte.estado).toBe(hacia);
  });

  it.each(invalidos)('rechaza %s → %s', (desde, hacia) => {
    const reporte = enEstado(desde);

    expect(() => INTENTAR[hacia](reporte)).toThrow(ErrorTransicionInvalida);
    expect(reporte.estado).toBe(desde);
    expect(reporte.extraerEventos()).toEqual([]);
  });

  it('un estado final deja de estar vigente', () => {
    expect(enEstado('CONFIRMADO').estaActivo).toBe(true);
    expect(enEstado('RESUELTO').estaActivo).toBe(false);
    expect(enEstado('CADUCADO').estaActivo).toBe(false);
    expect(enEstado('RECHAZADO').estaActivo).toBe(false);
  });
});

describe('Reporte: confirmación y extensiones', () => {
  it('HU-03: al confirmarse, un accidente (TTL 180) extiende su caducidad 90 minutos', () => {
    const reporte = crear('accidente');
    reporte.extraerEventos();

    reporte.marcarConfirmado(minutosDespues(10));

    expect(reporte).toMatchObject({
      estado: 'CONFIRMADO',
      caducaEn: minutosDespues(270),
      extensiones: 1,
    });
    expect(reporte.extraerEventos()).toEqual([
      { tipo: 'ReporteConfirmado', ocurridoEn: minutosDespues(10), caducaEn: minutosDespues(270) },
    ]);
  });

  it('HU-03: la segunda extensión añade otro 50 % del TTL original', () => {
    const reporte = enEstado('CONFIRMADO');

    reporte.extenderCaducidad(minutosDespues(20));

    expect(reporte).toMatchObject({ caducaEn: minutosDespues(360), extensiones: 2 });
    expect(reporte.extraerEventos()).toEqual([
      { tipo: 'ReporteExtendido', ocurridoEn: minutosDespues(20), caducaEn: minutosDespues(360) },
    ]);
  });

  it('HU-03: ninguna confirmación posterior extiende más allá de dos veces', () => {
    const reporte = enEstado('CONFIRMADO');
    reporte.extenderCaducidad(creado);

    expect(() => reporte.extenderCaducidad(creado)).toThrow(ErrorLimiteDeExtensiones);
    expect(reporte).toMatchObject({ caducaEn: minutosDespues(360), extensiones: 2 });
  });

  it.each(['ACTIVO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'un reporte %s no admite extensión',
    (estado) => {
      expect(() => enEstado(estado).extenderCaducidad(creado)).toThrow(ErrorTransicionInvalida);
    },
  );
});

describe('Reporte: caducidad', () => {
  it('HU-04: un accidente de hace 181 minutos pasa a CADUCADO', () => {
    const reporte = crear('accidente');
    reporte.extraerEventos();

    reporte.caducar(minutosDespues(181));

    expect(reporte.estado).toBe('CADUCADO');
    expect(reporte.extraerEventos()).toEqual([
      { tipo: 'ReporteCaducado', ocurridoEn: minutosDespues(181) },
    ]);
  });

  it('HU-04: a los 179 minutos conserva su estado', () => {
    const reporte = crear('accidente');

    expect(() => reporte.caducar(minutosDespues(179))).toThrow(ErrorAunNoCaduca);
    expect(reporte.estado).toBe('ACTIVO');
  });

  it('HU-04: un reporte CONFIRMADO caduca cuando pasa su caducidad extendida', () => {
    const reporte = enEstado('CONFIRMADO'); // caducidad extendida a los 270 minutos

    expect(() => reporte.caducar(minutosDespues(200))).toThrow(ErrorAunNoCaduca);
    reporte.caducar(minutosDespues(271));

    expect(reporte.estado).toBe('CADUCADO');
  });
});

describe('Reporte: resolución y rechazo', () => {
  it('HU-03: las negaciones de la comunidad lo dejan RESUELTO', () => {
    const reporte = enEstado('CONFIRMADO');

    reporte.marcarResuelto(minutosDespues(30));

    expect(reporte.estado).toBe('RESUELTO');
    expect(reporte.extraerEventos()).toEqual([
      { tipo: 'ReporteResuelto', ocurridoEn: minutosDespues(30) },
    ]);
  });

  it('HU-12: un moderador lo rechaza y queda registrado el motivo', () => {
    const reporte = enEstado('ACTIVO');

    reporte.rechazar('MODERACION', minutosDespues(5));

    expect(reporte).toMatchObject({ estado: 'RECHAZADO', motivoRechazo: 'MODERACION' });
    expect(reporte.extraerEventos()).toEqual([
      { tipo: 'ReporteRechazado', ocurridoEn: minutosDespues(5), motivo: 'MODERACION' },
    ]);
  });

  it('el reporte de un autor silenciado se crea ACTIVO y pasa de inmediato a RECHAZADO', () => {
    const reporte = crear();

    reporte.rechazar('AUTOR_SILENCIADO', creado);

    expect(reporte).toMatchObject({ estado: 'RECHAZADO', motivoRechazo: 'AUTOR_SILENCIADO' });
    expect(reporte.extraerEventos().map((evento) => evento.tipo)).toEqual([
      'ReporteCreado',
      'ReporteRechazado',
    ]);
  });
});

describe('Reporte: persistencia y eventos', () => {
  it('se reconstruye sin registrar eventos', () => {
    const original = enEstado('CONFIRMADO');

    const restaurado = Reporte.restaurar({
      id: original.id,
      codigoCategoria: original.codigoCategoria,
      authorId: original.authorId,
      location: original.location,
      publicLocation: original.publicLocation,
      estado: original.estado,
      ttlMinutos: original.ttlMinutos,
      creadoEn: original.creadoEn,
      caducaEn: original.caducaEn,
      extensiones: original.extensiones,
      motivoRechazo: original.motivoRechazo,
      idempotencyKey: original.idempotencyKey,
      descripcion: original.descripcion,
      fuenteOficial: original.fuenteOficial,
    });

    expect(restaurado).toMatchObject({ estado: 'CONFIRMADO', extensiones: 1 });
    expect(restaurado.extraerEventos()).toEqual([]);
  });

  it('entregar los eventos vacía la lista', () => {
    const reporte = crear();

    expect(reporte.extraerEventos()).toHaveLength(1);
    expect(reporte.extraerEventos()).toEqual([]);
  });
});

describe('Reporte: descripción privada', () => {
  const otro = idUsuario('22222222-2222-4222-8222-222222222222');

  it('HU-10: el autor describe su reporte vigente y se registra DescripcionAgregada', () => {
    const reporte = enEstado('CONFIRMADO');

    reporte.agregarDescripcion('  Camión volcado en el carril derecho  ', autor, creado);

    expect(reporte.descripcion).toBe('Camión volcado en el carril derecho');
    expect(reporte.extraerEventos()).toEqual([{ tipo: 'DescripcionAgregada', ocurridoEn: creado }]);
  });

  it('HU-10: un reporte nuevo no tiene descripción', () => {
    expect(crear().descripcion).toBeNull();
  });

  it('HU-10: solo el autor puede describirlo', () => {
    expect(() => crear().agregarDescripcion('texto', otro, creado)).toThrow(ErrorNoEsElAutor);
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'HU-10: un reporte %s ya no se puede describir',
    (estado) => {
      expect(() => enEstado(estado).agregarDescripcion('texto', autor, creado)).toThrow(
        ErrorReporteNoVigente,
      );
    },
  );

  it('HU-10: la descripción se agrega una sola vez', () => {
    const reporte = crear();
    reporte.agregarDescripcion('primera', autor, creado);

    expect(() => reporte.agregarDescripcion('segunda', autor, creado)).toThrow(
      ErrorDescripcionYaAgregada,
    );
  });

  it.each([
    ['vacía', '   '],
    ['demasiado larga', 'a'.repeat(MAX_DESCRIPCION + 1)],
  ])('HU-10: rechaza una descripción %s', (_caso, texto) => {
    expect(() => crear().agregarDescripcion(texto, autor, creado)).toThrow(
      ErrorDescripcionInvalida,
    );
  });

  it('HU-10: cuenta los emoji como un carácter, igual que la base de datos', () => {
    const reporte = crear();

    reporte.agregarDescripcion('🚧'.repeat(MAX_DESCRIPCION), autor, creado);

    expect([...reporte.descripcion!]).toHaveLength(MAX_DESCRIPCION);
  });
});

describe('Reporte: fuente oficial', () => {
  it('HU-13: un reporte comunitario no tiene fuente oficial', () => {
    const reporte = crear();

    expect(reporte.fuenteOficial).toBeNull();
    expect(reporte.esOficial).toBe(false);
  });

  it('HU-13: un reporte oficial nace ACTIVO con su fuente', () => {
    const reporte = Reporte.crear({
      id: idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
      categoria: categoria('bloqueo'),
      authorId: autor,
      location: laPaz,
      idempotencyKey: CLAVE,
      ahora: creado,
      fuenteOficial: 'TRANSITO',
    });

    expect(reporte).toMatchObject({ estado: 'ACTIVO', fuenteOficial: 'TRANSITO', esOficial: true });
    expect(reporte.extraerEventos()).toEqual([{ tipo: 'ReporteCreado', ocurridoEn: creado }]);
  });

  it('HU-13: reconoce solo las fuentes del catálogo', () => {
    expect(FUENTES_OFICIALES).toEqual(['TRANSITO', 'ABC', 'MI_TELEFERICO', 'OTRA']);
  });
});
