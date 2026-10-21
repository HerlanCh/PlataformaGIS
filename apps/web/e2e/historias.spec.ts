// Historias del frontend (Fase 8), de punta a punta contra una API real.
import { expect, test } from '@playwright/test';
import {
  abrir,
  dispositivo,
  estacionesEnElMapa,
  infracciones,
  puntoAlAzar,
  reportar,
  reportesDesde,
  SERVICIO_PUSH_SIMULADO,
  ubicarme,
} from './apoyo.js';

test('HU-01 y HU-02: un reporte en dos toques aparece en vivo en otro navegador', async ({
  browser,
}) => {
  const punto = puntoAlAzar();
  const autora = await dispositivo(browser, punto);
  const vecino = await dispositivo(browser, punto);
  await abrir(autora.pagina);
  await abrir(vecino.pagina);
  await ubicarme(vecino.pagina);
  await expect(vecino.pagina.getByText('En vivo')).toBeVisible();
  const antes = await estacionesEnElMapa(vecino.pagina);

  await reportar(autora.pagina, /Bloqueo o protesta vial/);

  await expect(autora.pagina.getByText('Reporte enviado. Ya aparece en el mapa.')).toBeVisible();
  // El vecino lo ve llegar por el tiempo real, sin recargar.
  await expect.poll(() => estacionesEnElMapa(vecino.pagina)).toBe(antes + 1);
  await autora.contexto.close();
  await vecino.contexto.close();
});

test('HU-03: a menos de 150 m la app pregunta «¿Sigue ahí?» y el voto se registra', async ({
  browser,
}) => {
  const punto = puntoAlAzar();
  const autora = await dispositivo(browser, punto);
  await abrir(autora.pagina);
  await reportar(autora.pagina, /Bloqueo o protesta vial/);
  await expect(autora.pagina.getByText('Reporte enviado. Ya aparece en el mapa.')).toBeVisible();

  const vecino = await dispositivo(browser, punto);
  await abrir(vecino.pagina);
  await ubicarme(vecino.pagina);
  const tarjeta = vecino.pagina.getByRole('region', { name: /¿Sigue ahí el bloqueo/ });
  await expect(tarjeta).toBeVisible();
  await tarjeta.getByRole('button', { name: 'Sigue ahí' }).click();

  await expect(vecino.pagina.getByText('Gracias. Confirmaste que sigue ahí.')).toBeVisible();
  await autora.contexto.close();
  await vecino.contexto.close();
});

test('HU-05: sin conexión, 3 reportes quedan pendientes y al volver la señal llegan exactamente 3', async ({
  browser,
}) => {
  const punto = puntoAlAzar();
  const inicio = new Date(Date.now() - 60_000);
  const { contexto, pagina } = await dispositivo(browser, punto);
  await abrir(pagina);

  await contexto.setOffline(true);
  for (const categoria of [/Bloqueo o protesta vial/, /Accidente de tránsito/, /Jauría/]) {
    await reportar(pagina, categoria);
    await expect(pagina.getByText(/Sin señal: tu reporte se enviará/)).toBeVisible();
  }
  await expect(pagina.getByText('3 reportes pendientes de envío')).toBeVisible();

  await contexto.setOffline(false);

  await expect(pagina.getByText(/reportes? pendientes? de envío/)).toBeHidden();
  await expect
    .poll(async () =>
      (await reportesDesde(punto, inicio))
        .map((r) => r.codigoCategoria)
        .sort((a, b) => a.localeCompare(b)),
    )
    .toEqual(['accidente', 'bloqueo', 'jauria']);
  await contexto.close();
});

test('HU-05: si la red se corta durante el envío, el reporte llega una sola vez', async ({
  browser,
}) => {
  const punto = puntoAlAzar();
  const inicio = new Date(Date.now() - 60_000);
  const { contexto, pagina } = await dispositivo(browser, punto);
  await abrir(pagina);

  // El primer envío llega a la API y se guarda, pero la respuesta nunca vuelve al teléfono.
  type Respuesta = { resultado: string; reporte: { id: string } };
  const respuestas: Respuesta[] = [];
  const claves: string[] = [];
  await pagina.route('**/v1/reportes', async (ruta) => {
    if (ruta.request().method() !== 'POST') return ruta.continue();
    claves.push(ruta.request().headers()['idempotency-key'] ?? '');
    const respuesta = await ruta.fetch();
    respuestas.push((await respuesta.json()) as Respuesta);
    if (respuestas.length === 1) return ruta.abort('connectionreset');
    return ruta.fulfill({ response: respuesta });
  });

  await reportar(pagina, /Bloqueo o protesta vial/);
  await expect(pagina.getByText(/Sin señal: tu reporte se enviará/)).toBeVisible();
  await expect(pagina.getByText('1 reporte pendiente de envío')).toBeVisible();
  expect(respuestas[0]?.resultado).toBe('CREADO');

  // Vuelve la señal: la cola reenvía con la misma clave y la API repite su respuesta, sin crear
  // otro reporte. Un reenvío sin la clave daría PROPIO_EXISTENTE.
  await contexto.setOffline(true);
  await contexto.setOffline(false);

  await expect(pagina.getByText(/reportes? pendientes? de envío/)).toBeHidden();
  expect(new Set(claves).size).toBe(1);
  expect(respuestas[1]).toEqual(respuestas[0]);
  await expect
    .poll(async () => (await reportesDesde(punto, inicio)).map((r) => r.codigoCategoria))
    .toEqual(['bloqueo']);
  // Se espera un poco más: un duplicado tardío también haría fallar la prueba.
  await pagina.waitForTimeout(2000);
  expect((await reportesDesde(punto, inicio)).length).toBe(1);
  await contexto.close();
});

test('HU-06: el historial muestra el mapa de calor y explica el umbral', async ({ browser }) => {
  const { contexto, pagina } = await dispositivo(browser, puntoAlAzar());
  await abrir(pagina);
  const calor = pagina.waitForResponse((r) => r.url().includes('/v1/mapa-calor') && r.ok());

  await pagina.getByRole('radio', { name: 'Historial' }).check();

  await calor;
  await expect(pagina.getByRole('radio', { name: '30 días' })).toBeChecked();
  await expect(pagina.getByText(/3 o más/)).toBeVisible();
  await contexto.close();
});

test('HU-07: crear, ver y eliminar una zona suscrita', async ({ browser }) => {
  const { contexto, pagina } = await dispositivo(browser, puntoAlAzar());
  await abrir(pagina);

  await pagina.getByRole('button', { name: 'Mis zonas' }).click();
  await pagina.getByRole('button', { name: 'Nueva zona' }).click();
  await pagina.getByRole('button', { name: 'Robo' }).click();
  await pagina.getByRole('button', { name: 'Guardar zona' }).click();

  await expect(pagina.getByText('Zona guardada.')).toBeVisible();
  await expect(pagina.getByText('Zona 1 · radio de 500 m')).toBeVisible();
  await pagina.getByRole('button', { name: 'Eliminar la zona 1' }).click();
  await pagina.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(pagina.getByText(/Aún no tienes zonas/)).toBeVisible();
  await contexto.close();
});

test('HU-08: activar los avisos guarda la suscripción del dispositivo', async ({ browser }) => {
  const { contexto, pagina } = await dispositivo(browser, puntoAlAzar(), [
    'geolocation',
    'notifications',
  ]);
  await contexto.addInitScript(SERVICIO_PUSH_SIMULADO);
  await abrir(pagina);
  await pagina.getByRole('button', { name: 'Mis zonas' }).click();
  const alta = pagina.waitForResponse(
    (r) => r.url().endsWith('/v1/notificaciones/push') && r.request().method() === 'POST',
  );

  await pagina.getByRole('button', { name: 'Activar avisos en este dispositivo' }).click();

  expect((await alta).status()).toBe(204);
  await expect(pagina.getByText('Avisos activados en este dispositivo.')).toBeVisible();
  const baja = pagina.waitForResponse(
    (r) => r.url().endsWith('/v1/notificaciones/push') && r.request().method() === 'DELETE',
  );
  await pagina.getByRole('button', { name: 'Desactivar' }).click();
  expect((await baja).status()).toBe(204);
  await expect(
    pagina.getByRole('button', { name: 'Activar avisos en este dispositivo' }),
  ).toBeVisible();
  await contexto.close();
});

test('la app es instalable: manifiesto, iconos y service worker', async ({ page, request }) => {
  await page.goto('/');
  const enlace = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifiesto = (await (await request.get(enlace!)).json()) as {
    name: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };

  expect(manifiesto).toMatchObject({ name: 'Alerta La Paz y El Alto', display: 'standalone' });
  expect(manifiesto.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
  );
  for (const icono of manifiesto.icons) expect((await request.get(icono.src)).ok()).toBe(true);
  expect(await page.evaluate(async () => Boolean(await navigator.serviceWorker.ready))).toBe(true);
});

test('sin infracciones de accesibilidad en la pantalla principal y las hojas', async ({
  browser,
}) => {
  const { contexto, pagina } = await dispositivo(browser, puntoAlAzar());
  await abrir(pagina);
  expect(await infracciones(pagina)).toEqual([]);

  for (const [abrirHoja, cerrar] of [
    ['Reportar', 'Cerrar'],
    ['Filtrar', 'Listo'],
    ['Mis zonas', 'Cerrar'],
  ] as const) {
    await pagina.getByRole('button', { name: abrirHoja, exact: true }).click();
    await expect(pagina.getByRole('dialog')).toBeVisible();
    expect(await infracciones(pagina), abrirHoja).toEqual([]);
    await pagina.getByRole('dialog').getByRole('button', { name: cerrar }).click();
  }
  await contexto.close();
});
