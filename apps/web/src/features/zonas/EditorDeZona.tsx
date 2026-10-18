import { BellOff } from 'lucide-react';
import { useId, useState } from 'react';
import { CATEGORIAS } from '../../domain/categorias.js';
import type { CodigoCategoria } from '../../domain/categorias.js';
import { formatearDistancia } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { RADIO_MAXIMO_M, RADIO_MINIMO_M, useZonas } from './usarZonas.js';

const PASO_M = 50;

/**
 * Editor de zona (HU-07): reemplaza al panel mientras se dibuja. El centro es el del mapa, bajo la
 * mira; el radio sale del control deslizante y el círculo se dibuja en vivo.
 */
export function EditorDeZona() {
  const zona = useEstado((s) => s.zonaEnEdicion);
  const fijarRadio = useEstado((s) => s.fijarRadio);
  const terminar = useEstado((s) => s.terminarZona);
  const { crear } = useZonas();
  const [lineas, setLineas] = useState<readonly CodigoCategoria[]>(CATEGORIAS.map((c) => c.codigo));
  const idRadio = useId();

  if (!zona) return null;
  const alternar = (codigo: CodigoCategoria) =>
    setLineas((actuales) =>
      actuales.includes(codigo) ? actuales.filter((c) => c !== codigo) : [...actuales, codigo],
    );
  const guardar = () => {
    if (!zona.centro || lineas.length === 0) return;
    crear.mutate({
      latitud: zona.centro.latitud,
      longitud: zona.centro.longitud,
      radioM: zona.radioM,
      categorias: lineas,
    });
  };

  return (
    <section className="panel editor" aria-labelledby="titulo-editor">
      <div className="panel__cabecera">
        <h2 id="titulo-editor" className="panel__titulo">
          Nueva zona
        </h2>
      </div>
      <div className="editor__cuerpo">
        <p className="editor__ayuda">Mueve el mapa: el centro queda bajo la mira.</p>
        <div className="radio">
          <label htmlFor={idRadio} className="radio__etiqueta">
            Radio
          </label>
          <output htmlFor={idRadio} className="radio__valor">
            {formatearDistancia(zona.radioM)}
          </output>
          <input
            id={idRadio}
            className="radio__control"
            type="range"
            min={RADIO_MINIMO_M}
            max={RADIO_MAXIMO_M}
            step={PASO_M}
            value={zona.radioM}
            aria-valuetext={formatearDistancia(zona.radioM)}
            onChange={(e) => fijarRadio(Number(e.target.value))}
          />
        </div>
        <fieldset className="chips">
          <legend className="chips__etiqueta">Avisarme de</legend>
          {CATEGORIAS.map((categoria) => {
            const elegida = lineas.includes(categoria.codigo);
            return (
              <button
                key={categoria.codigo}
                type="button"
                className="chip"
                aria-pressed={elegida}
                onClick={() => alternar(categoria.codigo)}
              >
                <Estacion color={categoria.color} estado="CONFIRMADO" tamano={20} />
                {categoria.corto}
                {/* Apagada: la campana tachada lo dice sin depender del color. */}
                {!elegida && <BellOff aria-hidden="true" size={16} strokeWidth={TRAZO} />}
              </button>
            );
          })}
        </fieldset>
        {lineas.length === 0 && <p className="editor__error">Elige al menos una línea.</p>}
      </div>
      <div className="panel__accion editor__acciones">
        <button type="button" className="boton-texto" onClick={terminar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          disabled={!zona.centro || lineas.length === 0 || crear.isPending}
          onClick={guardar}
        >
          {crear.isPending ? 'Guardando…' : 'Guardar zona'}
        </button>
      </div>
    </section>
  );
}
