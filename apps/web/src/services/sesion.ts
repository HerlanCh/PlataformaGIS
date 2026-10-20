// Identidad anónima del dispositivo (RF-01): un hash aleatorio que no identifica a la persona, y
// el token que la API entrega al registrarlo. Vive en IndexedDB para que el service worker pueda
// usarlo al enviar reportes pendientes.
import { abrirAlmacen } from './almacen.js';
import type { Rol, Sesion } from './almacen.js';

const CLAVE = 'actual';
/** Se renueva el token un poco antes de que venza. */
const MARGEN_MS = 5 * 60 * 1000;

const nuevoHash = (): string => `web-${crypto.randomUUID().replaceAll('-', '')}`;

async function leer(): Promise<Sesion> {
  const db = await abrirAlmacen();
  const guardada = await db.get('sesion', CLAVE);
  if (guardada) return guardada;
  const nueva: Sesion = {
    hashDispositivo: nuevoHash(),
    idUsuario: null,
    token: null,
    expiraEn: null,
  };
  await db.put('sesion', nueva, CLAVE);
  return nueva;
}

const vigente = (sesion: Sesion, ahora: number): boolean =>
  sesion.token !== null &&
  sesion.expiraEn !== null &&
  Date.parse(sesion.expiraEn) - MARGEN_MS > ahora;

export class ErrorDeRegistro extends Error {
  constructor(readonly status: number) {
    super(`No se pudo registrar el dispositivo (${status})`);
  }
}

/** Registro en curso: al abrir la app varias partes piden el token a la vez y comparten uno. */
let registroEnCurso: Promise<string> | null = null;

/**
 * Token vigente del dispositivo. Si no hay o está por vencer, registra el dispositivo de nuevo:
 * `POST /v1/dispositivos` es idempotente y devuelve el mismo usuario con un token nuevo. Las
 * llamadas simultáneas comparten el mismo registro.
 */
export async function obtenerToken(
  urlApi: string,
  opciones: { forzar?: boolean; fetch?: typeof fetch } = {},
): Promise<string> {
  const sesion = await leer();
  if (!opciones.forzar && vigente(sesion, Date.now())) return sesion.token!;
  registroEnCurso ??= registrar(urlApi, sesion, opciones.fetch ?? fetch).finally(() => {
    registroEnCurso = null;
  });
  return registroEnCurso;
}

async function registrar(urlApi: string, sesion: Sesion, pedir: typeof fetch): Promise<string> {
  const respuesta = await pedir(`${urlApi}/v1/dispositivos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hashDispositivo: sesion.hashDispositivo }),
  });
  if (!respuesta.ok) throw new ErrorDeRegistro(respuesta.status);
  const credencial = (await respuesta.json()) as {
    idUsuario: string;
    rol?: Rol;
    token: string;
    expiraEn: string;
  };
  const actualizada: Sesion = {
    hashDispositivo: sesion.hashDispositivo,
    idUsuario: credencial.idUsuario,
    token: credencial.token,
    expiraEn: credencial.expiraEn,
    rol: credencial.rol ?? 'CIUDADANO',
  };
  await (await abrirAlmacen()).put('sesion', actualizada, CLAVE);
  return credencial.token;
}

/** Rol de la credencial guardada: el de moderador llega con el próximo token (HU-12). */
export async function rolActual(): Promise<Rol> {
  return (await leer()).rol ?? 'CIUDADANO';
}

/** Usuario del dispositivo, si ya se registró. */
export async function idUsuarioActual(): Promise<string | null> {
  return (await leer()).idUsuario;
}
