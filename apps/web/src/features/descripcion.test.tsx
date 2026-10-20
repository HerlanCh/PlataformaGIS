import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { reiniciarAlmacen } from '../services/almacen.js';
import { describirReporte, MAX_DESCRIPCION } from '../services/descripcion.js';
import { Avisos } from '../ui/Avisos.js';
import { HojaDeDescripcion } from './reporte/HojaDeDescripcion.js';
import { mensajeDeDescripcion } from './reporte/mensajes.js';

const API = 'http://api.prueba';
const ID = '33333333-3333-4333-8333-333333333333';

const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const pedidos: Request[] = [];

/** API falsa: registra el dispositivo y responde al PATCH de la descripción con `respuesta`. */
function api(respuesta: () => Response | Promise<Response>) {
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const solicitud = new Request(entrada, init);
    pedidos.push(solicitud.clone());
    if (solicitud.url.endsWith('/v1/dispositivos')) {
      return json({
        idUsuario: '11111111-1111-4111-8111-111111111111',
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    return respuesta();
  });
  vi.stubGlobal('fetch', pedir);
  return pedir as unknown as typeof fetch;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  pedidos.length = 0;
  useEstado.setState({ aviso: null, describiendo: null });
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

describe('descripción privada del reporte (HU-10)', () => {
  it('HU-10: el aviso de un reporte creado ofrece añadir un detalle y abre la hoja', () => {
    render(<Avisos />);
    act(() => useEstado.getState().avisar('exito', 'Reporte enviado.', ID));

    fireEvent.click(screen.getByRole('button', { name: 'Añadir detalle' }));

    expect(useEstado.getState()).toMatchObject({ describiendo: ID, aviso: null });
  });

  it('HU-10: un aviso sin reporte creado no ofrece la acción', () => {
    render(<Avisos />);
    act(() => useEstado.getState().avisar('info', 'Sin señal.'));

    expect(screen.queryByRole('button', { name: 'Añadir detalle' })).toBeNull();
  });

  it('HU-10: envía el detalle recortado por PATCH, avisa y cierra la hoja', async () => {
    api(() => json(null, 204));
    useEstado.setState({ describiendo: ID });
    render(<HojaDeDescripcion idReporte={ID} />);

    fireEvent.change(screen.getByLabelText('Detalle del reporte'), {
      target: { value: '  Poste caído sobre la acera  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar detalle' }));

    await waitFor(() => expect(useEstado.getState().describiendo).toBeNull());
    const patch = pedidos.find((p) => p.method === 'PATCH')!;
    expect(patch.url.endsWith(`/v1/reportes/${ID}/descripcion`)).toBe(true);
    expect(await patch.json()).toEqual({ descripcion: 'Poste caído sobre la acera' });
    expect(useEstado.getState().aviso?.texto).toContain('Detalle guardado');
  });

  it('HU-10: no deja guardar un detalle vacío ni uno de más de 280 caracteres', () => {
    render(<HojaDeDescripcion idReporte={ID} />);
    const campo = screen.getByLabelText('Detalle del reporte');
    const guardar = screen.getByRole('button', { name: 'Guardar detalle' });

    expect(guardar).toHaveProperty('disabled', true);
    fireEvent.change(campo, { target: { value: 'a'.repeat(MAX_DESCRIPCION + 1) } });
    expect(guardar).toHaveProperty('disabled', true);
    expect(
      screen.getByText(`${MAX_DESCRIPCION + 1} de ${MAX_DESCRIPCION} caracteres`),
    ).toBeTruthy();
    fireEvent.change(campo, { target: { value: '🚧'.repeat(MAX_DESCRIPCION) } });
    expect(guardar).toHaveProperty('disabled', false);
  });

  it('HU-10: sin señal la hoja sigue abierta para reintentar', async () => {
    api(() => Promise.reject(new TypeError('sin red')));
    useEstado.setState({ describiendo: ID });
    render(<HojaDeDescripcion idReporte={ID} />);

    fireEvent.change(screen.getByLabelText('Detalle del reporte'), { target: { value: 'texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar detalle' }));

    await waitFor(() => expect(useEstado.getState().aviso?.texto).toContain('Sin señal'));
    expect(useEstado.getState().describiendo).toBe(ID);
  });

  it('la hoja no tiene infracciones de accesibilidad', async () => {
    const { container } = render(<HojaDeDescripcion idReporte={ID} />);

    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-10: traduce cada resultado a un mensaje', async () => {
    const pedir = api(() => json({ codigo: 'DESCRIPCION_YA_AGREGADA' }, 409));

    const resultado = await describirReporte(API, ID, 'texto', pedir);

    expect(resultado).toMatchObject({ tipo: 'RECHAZADO', codigo: 'DESCRIPCION_YA_AGREGADA' });
    expect(mensajeDeDescripcion(resultado).texto).toBe('Ese reporte ya tiene un detalle.');
    expect(
      mensajeDeDescripcion({ tipo: 'RECHAZADO', codigo: 'REPORTE_NO_VIGENTE', reintentarEnS: null })
        .texto,
    ).toBe('El reporte ya no está vigente.');
    expect(
      mensajeDeDescripcion({ tipo: 'RECHAZADO', codigo: 'OTRO', reintentarEnS: null }).tono,
    ).toBe('problema');
    expect(
      await describirReporte(
        API,
        ID,
        'texto',
        api(() => json({}, 503)),
      ),
    ).toEqual({
      tipo: 'SIN_RED',
    });
  });
});
