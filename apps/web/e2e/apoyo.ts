// Apoyo de las pruebas de extremo a extremo: un punto al azar por corrida, navegadores con la
// ubicación concedida y la lectura de la API para comprobar lo que llegó.
import { randomInt } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export interface Punto {
  readonly latitud: number;
  readonly longitud: number;
}

/**
 * Un punto al azar dentro de la ciudad. Así cada corrida reporta lejos de la anterior y la API no
 * toma sus reportes como duplicados de otros vigentes.
 */
export function puntoAlAzar(): Punto {
  const enRango = (min: number, max: number) =>
    min + (randomInt(0, 1_000_000) / 1_000_000) * (max - min);
  return { latitud: enRango(-16.56, -16.48), longitud: enRango(-68.22, -68.1) };
}

/** Un dispositivo nuevo (su propia identidad anónima) con el GPS en `punto`. */
export async function dispositivo(
  browser: Browser,
  punto: Punto,
  permisos: string[] = ['geolocation'],
): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await browser.newContext({
    geolocation: { latitude: punto.latitud, longitude: punto.longitud },
    permissions: permisos,
  });
  const pagina = await contexto.newPage();
  return { contexto, pagina };
}

/** Abre la app y espera a que el mapa y el registro del dispositivo estén listos. */
export async function abrir(pagina: Page): Promise<void> {
  const registro = pagina.waitForResponse((r) => r.url().endsWith('/v1/dispositivos') && r.ok(), {
    timeout: 90_000,
  });
  await pagina.goto('/');
  await expect(pagina.getByRole('application', { name: 'Mapa de incidentes' })).toBeVisible();
  await registro;
}

/** Lleva el mapa a la posición del GPS («Centrar en mi ubicación»). */
export async function ubicarme(pagina: Page): Promise<void> {
  // El mapa vuela hasta el punto y después pide los reportes de su ventana nueva.
  const ventana = pagina.waitForResponse(
    (r) => r.url().includes('/v1/reportes?') && r.ok() && r.request().method() === 'GET',
  );
  await pagina.getByRole('button', { name: 'Centrar en mi ubicación' }).click();
  await expect(pagina.getByRole('heading', { name: 'Cerca de ti' })).toBeVisible();
  await ventana;
}

/** Reporta en dos toques (HU-01). */
export async function reportar(pagina: Page, categoria: RegExp): Promise<void> {
  await pagina.getByRole('button', { name: 'Reportar' }).click();
  await pagina.getByRole('button', { name: categoria }).click();
}

/** Estaciones dibujadas en el mapa: las sueltas más las que están dentro de un transbordo. */
export const estacionesEnElMapa = (pagina: Page): Promise<number> =>
  pagina.evaluate(() => {
    const sueltas = document.querySelectorAll('.marcador').length;
    const agrupadas = [...document.querySelectorAll('.transbordo span')].reduce(
      (total, e) => total + Number(e.textContent),
      0,
    );
    return sueltas + agrupadas;
  });

interface ReporteDeLaApi {
  readonly codigoCategoria: string;
  readonly creadoEn: string;
}

/** Reportes vigentes alrededor de `punto` creados desde `desde`, según la API. */
export async function reportesDesde(punto: Punto, desde: Date): Promise<ReporteDeLaApi[]> {
  const margen = 0.01;
  const bbox = [
    punto.longitud - margen,
    punto.latitud - margen,
    punto.longitud + margen,
    punto.latitud + margen,
  ].join(',');
  const respuesta = await fetch(`${API_URL}/v1/reportes?bbox=${bbox}`);
  const { reportes } = (await respuesta.json()) as { reportes: ReporteDeLaApi[] };
  return reportes.filter((r) => Date.parse(r.creadoEn) >= desde.getTime());
}

/** Infracciones de accesibilidad de la pantalla (axe-core), sin las teselas del mapa. */
export async function infracciones(pagina: Page): Promise<string[]> {
  const resultado = await new AxeBuilder({ page: pagina }).exclude('.leaflet-tile-pane').analyze();
  return resultado.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

/**
 * Un navegador automatizado no puede hablar con el servicio push real (FCM), así que la prueba
 * reemplaza solo `pushManager.subscribe` por una suscripción con la forma real. Todo lo demás
 * (permiso, alta y baja en la API) es de verdad; la entrega del aviso se prueba en el backend.
 */
export const SERVICIO_PUSH_SIMULADO = () => {
  let actual: PushSubscription | null = null;
  const crear = (): PushSubscription => {
    const endpoint = `https://push.example.org/${crypto.randomUUID()}`;
    const json = {
      endpoint,
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    };
    return {
      endpoint,
      toJSON: () => json,
      unsubscribe: () => {
        actual = null;
        return Promise.resolve(true);
      },
    } as unknown as PushSubscription;
  };
  PushManager.prototype.subscribe = function () {
    actual = crear();
    return Promise.resolve(actual);
  };
  PushManager.prototype.getSubscription = function () {
    return Promise.resolve(actual);
  };
};
