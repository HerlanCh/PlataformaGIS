import { Pagina } from '../../ui/Pagina.js';

const REPOSITORIO = 'https://github.com/HerlanCh/PlataformaGIS';

/** Aviso que encabeza ambas pantallas: la app no reemplaza a las líneas de emergencia. */
function Emergencias() {
  return (
    <p className="legal__emergencia" role="note">
      <strong>Esta app no reemplaza a las líneas de emergencia.</strong> Si hay una vida en riesgo,
      llama al 110 (Policía) o al 119 (Bomberos).
    </p>
  );
}

function Otra({ href, texto }: { readonly href: string; readonly texto: string }) {
  return (
    <p className="pagina__ayuda legal__otra">
      <a href={href}>{texto}</a>
    </p>
  );
}

/** Política de privacidad (roadmap 12): qué se guarda, qué se publica y qué nunca se publica. */
export function PantallaDePrivacidad() {
  return (
    <Pagina titulo="Privacidad">
      <Emergencias />
      <section className="legal" aria-labelledby="privacidad-cuenta">
        <h2 id="privacidad-cuenta">No te pedimos quién eres</h2>
        <p>
          No hay registro con nombre, correo ni teléfono. Tu teléfono se identifica con un código
          anónimo que genera la app, y con él se asocian tus reportes y tus votos.
        </p>
      </section>
      <section className="legal" aria-labelledby="privacidad-reporte">
        <h2 id="privacidad-reporte">Qué pasa con un reporte</h2>
        <ul>
          <li>
            Guardamos la categoría, el punto donde lo hiciste y, si la agregas, una descripción.
          </li>
          <li>
            En el mapa se muestra el punto del incidente. En los robos solo se muestra el centro de
            una zona de 200 m, nunca el punto exacto.
          </li>
          <li>
            Nadie más ve quién hizo el reporte. La descripción no se publica: solo la revisan el
            clasificador automático y los moderadores.
          </li>
          <li>El reporte desaparece del mapa cuando caduca, se resuelve o se rechaza.</li>
        </ul>
      </section>
      <section className="legal" aria-labelledby="privacidad-ubicacion">
        <h2 id="privacidad-ubicacion">Tu ubicación</h2>
        <p>
          La app usa tu ubicación solo para crear un reporte o mostrarte lo que pasa cerca, y solo
          si le das permiso. No sigue tus movimientos.
        </p>
      </section>
      <section className="legal" aria-labelledby="privacidad-avisos">
        <h2 id="privacidad-avisos">Avisos y zonas</h2>
        <p>
          Si te suscribes a una zona, guardamos esa zona y la dirección de avisos de tu navegador
          para enviarte los incidentes de ahí. Puedes quitar la zona o desactivar los avisos cuando
          quieras.
        </p>
      </section>
      <section className="legal" aria-labelledby="privacidad-abiertos">
        <h2 id="privacidad-abiertos">Datos abiertos</h2>
        <p>
          Cuando un reporte termina, se publica en los <a href="/datos-abiertos">datos abiertos</a>{' '}
          sin autor, sin descripción y sin el punto: solo la categoría, una zona de 500 m, la hora y
          cómo terminó.
        </p>
      </section>
      <section className="legal" aria-labelledby="privacidad-servicios">
        <h2 id="privacidad-servicios">Servicios que usamos</h2>
        <p>
          El mapa se descarga de OpenStreetMap. La app funciona en servicios de alojamiento en la
          nube (Vercel, Render y Neon); no vendemos ni compartimos tus datos con nadie más.
        </p>
        <p>
          Cuando la app falla, enviamos el error a GlitchTip para poder corregirlo: el mensaje y la
          pantalla, sin tu ubicación, tus reportes ni ningún identificador.
        </p>
      </section>
      <section className="legal" aria-labelledby="privacidad-contacto">
        <h2 id="privacidad-contacto">Dudas o pedidos</h2>
        <p>
          Puedes escribirnos abriendo un tema en el{' '}
          <a href={`${REPOSITORIO}/issues`} rel="noopener noreferrer" target="_blank">
            repositorio del proyecto
          </a>
          .
        </p>
      </section>
      <Otra href="/terminos" texto="Términos de uso" />
    </Pagina>
  );
}

/** Términos de uso (roadmap 12): qué se puede reportar y qué no. */
export function PantallaDeTerminos() {
  return (
    <Pagina titulo="Términos de uso">
      <Emergencias />
      <section className="legal" aria-labelledby="terminos-que">
        <h2 id="terminos-que">Qué es Alerta LP</h2>
        <p>
          Una plataforma comunitaria y gratuita para avisar de bloqueos, accidentes, robos, daños en
          la vía y jaurías en La Paz y El Alto. La información la ponen los vecinos y la confirma la
          comunidad: puede tener errores.
        </p>
      </section>
      <section className="legal" aria-labelledby="terminos-reglas">
        <h2 id="terminos-reglas">Al reportar, te comprometes a</h2>
        <ul>
          <li>Reportar solo lo que viste o sabes que está pasando.</li>
          <li>
            No describir ni identificar a personas: ni nombres, ni rasgos, ni placas, ni fotos de
            nadie.
          </li>
          <li>No publicar datos de terceros, como teléfonos o direcciones de domicilios.</li>
          <li>No usar la app para acosar, amenazar o difundir información falsa.</li>
        </ul>
      </section>
      <section className="legal" aria-labelledby="terminos-moderacion">
        <h2 id="terminos-moderacion">Moderación</h2>
        <p>
          Los reportes que la comunidad niega o que incumplen estas reglas se retiran del mapa.
          Quien los repite deja de poder publicar.
        </p>
      </section>
      <section className="legal" aria-labelledby="terminos-garantia">
        <h2 id="terminos-garantia">Sin garantía</h2>
        <p>
          La app se ofrece tal como está, sin garantía de que esté siempre disponible ni de que cada
          reporte sea exacto. Decide con prudencia.
        </p>
      </section>
      <Otra href="/privacidad" texto="Privacidad" />
    </Pagina>
  );
}
