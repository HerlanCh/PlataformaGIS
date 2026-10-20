import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import { describirReporte, largoDe, MAX_DESCRIPCION } from '../../services/descripcion.js';
import { Hoja } from '../../ui/Hoja.js';
import { mensajeDeDescripcion } from './mensajes.js';

/**
 * Detalle opcional de un reporte propio, después de enviarlo (HU-10). Es privado: solo lo leen el
 * clasificador y el equipo de moderación. Por la regla ética, no se describe a personas.
 */
export function HojaDeDescripcion({ idReporte }: { readonly idReporte: string }) {
  const cerrar = useEstado((s) => s.cerrarDescripcion);
  const avisar = useEstado((s) => s.avisar);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const idCampo = useId();
  const idContador = useId();
  const largo = largoDe(texto);
  const valido = largo > 0 && largo <= MAX_DESCRIPCION;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setEnviando(true);
    const resultado = await describirReporte(URL_API, idReporte, texto);
    setEnviando(false);
    const { tono, texto: mensaje } = mensajeDeDescripcion(resultado);
    avisar(tono, mensaje);
    if (resultado.tipo !== 'SIN_RED') cerrar();
  };

  return (
    <Hoja
      abierta
      alCerrar={cerrar}
      titulo="Añadir detalle"
      ayuda="Cuenta qué pasa en el lugar. No describas ni nombres a personas: el detalle es privado y lo revisa el equipo de moderación."
    >
      <form className="descripcion" onSubmit={(e) => void enviar(e)}>
        <label htmlFor={idCampo} className="hoja__seccion">
          Detalle del reporte
        </label>
        <textarea
          id={idCampo}
          className="descripcion__campo"
          rows={4}
          value={texto}
          aria-describedby={idContador}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p
          id={idContador}
          className="hoja__nota descripcion__contador"
          data-excedido={largo > MAX_DESCRIPCION || undefined}
        >
          {largo} de {MAX_DESCRIPCION} caracteres
        </p>
        <div className="hoja__pie">
          <button type="submit" className="boton-primario" disabled={!valido || enviando}>
            Guardar detalle
          </button>
        </div>
      </form>
    </Hoja>
  );
}
