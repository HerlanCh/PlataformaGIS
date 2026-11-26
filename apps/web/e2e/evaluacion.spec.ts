// HU-14 (ADR-007): la tarea cronometrada en un navegador real, con Leaflet y toques de verdad. La API
// se reemplaza con respuestas fijas: en staging no hay moderadores de prueba ni módulo de
// evaluación activo, y esta prueba mira la interfaz, no la API (que tiene sus propias pruebas).
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const TAREA = '33333333-3333-4333-8333-333333333301';
const SESION = '33333333-3333-4333-8333-333333333300';
const CENTRO = { latitud: -16.5, longitud: -68.15 };
/** Tres incidentes a unos 450 m entre sí: en la zona de 1 km se ven sueltos, sin agruparse. */
const PUNTOS = [0, 1, 2].map((i) => ({
  idPunto: `44444444-4444-4444-8444-44444444440${i}`,
  codigoCategoria: ['bloqueo', 'accidente', 'jauria'][i]!,
  publicLocation: { latitud: CENTRO.latitud + (i - 1) * 0.004, longitud: CENTRO.longitud },
  estado: i === 0 ? 'CONFIRMADO' : 'ACTIVO',
  fuenteOficial: null,
}));

const tarea = (orden: 1 | 2, terminada = false) => ({
  id: orden === 1 ? TAREA : '33333333-3333-4333-8333-333333333302',
  orden,
  vista: orden === 1 ? 'PROCESADA' : 'BASE',
  escenario: orden === 1 ? 'E1' : 'E2',
  idInstantanea: '33333333-3333-4333-8333-3333333333e1',
  iniciadaEn: terminada ? '2026-11-22T12:00:00.000Z' : null,
  terminadaEn: terminada ? '2026-11-22T12:01:00.000Z' : null,
  duracionMs: terminada ? 60_000 : null,
  agotada: terminada ? false : null,
  marcas: [],
});

const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });

/** API falsa de moderador: una sesión con su primera tarea por empezar. Devuelve el cierre enviado. */
async function apiDeModerador(pagina: Page): Promise<{ cierre: () => unknown }> {
  let cierre: unknown = null;
  let terminada = false;
  await pagina.route('**/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const ruta = url.pathname;
    if (ruta.endsWith('/v1/dispositivos')) {
      return json(route, {
        idUsuario: '33333333-3333-4333-8333-3333333333aa',
        rol: 'MODERADOR',
        token: 'token-de-prueba',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (ruta.endsWith('/evaluacion/sesiones')) {
      return json(route, {
        sesiones: [
          {
            id: SESION,
            codigoParticipante: 'P01',
            secuencia: 2,
            creadaEn: '2026-11-22T11:59:00.000Z',
            tareas: [tarea(1, terminada), tarea(2)],
          },
        ],
      });
    }
    if (ruta.endsWith(`/tareas/${TAREA}/inicio`)) {
      return json(route, {
        idTarea: TAREA,
        orden: 1,
        iniciadaEn: new Date().toISOString(),
        duracionMaximaMs: 180_000,
        caja: {
          latitudMin: CENTRO.latitud - 0.009,
          latitudMax: CENTRO.latitud + 0.009,
          longitudMin: CENTRO.longitud - 0.009,
          longitudMax: CENTRO.longitud + 0.009,
        },
        puntos: PUNTOS,
      });
    }
    if (ruta.endsWith(`/tareas/${TAREA}/fin`)) {
      cierre = route.request().postDataJSON();
      terminada = true;
      return json(route, { ...tarea(1, true), marcas: (cierre as { marcas: unknown[] }).marcas });
    }
    return json(route, { instantaneas: [], avisos: [], sesiones: [], verificaciones: [] });
  });
  return { cierre: () => cierre };
}

test('HU-14: la tarea cronometrada marca y desmarca estaciones en el mapa y entrega lo marcado', async ({
  page,
}) => {
  const api = await apiDeModerador(page);
  await page.goto('/evaluacion');
  await page.getByRole('radio', { name: 'Tarea' }).check();
  await page.getByRole('button', { name: 'Empezar tarea 1' }).click();

  await expect(page.getByText('Tarea 1 de 2')).toBeVisible();
  const estaciones = page.locator('.marcador');
  await expect(estaciones).toHaveCount(3);
  // Las herramientas del mapa normal no están: solo el mapa, el tiempo y lo marcado.
  await expect(page.getByRole('button', { name: 'Centrar en mi ubicación' })).toHaveCount(0);

  await estaciones.nth(0).click();
  await estaciones.nth(1).click();
  await expect(page.getByText('2 marcados')).toBeVisible();
  await expect(page.locator('.marcador--marcado')).toHaveCount(2);
  await estaciones.nth(1).click();
  await expect(page.getByText('1 marcado')).toBeVisible();
  await page.getByRole('button', { name: 'Terminar' }).click();

  await expect(page.getByText('Tarea 1: terminada')).toBeVisible();
  const { marcas } = api.cierre() as { marcas: { idPunto: string; msDesdeInicio: number }[] };
  expect(marcas).toHaveLength(1);
  expect(PUNTOS.map((p) => p.idPunto)).toContain(marcas[0]!.idPunto);
  expect(marcas[0]!.msDesdeInicio).toBeGreaterThanOrEqual(0);
});
