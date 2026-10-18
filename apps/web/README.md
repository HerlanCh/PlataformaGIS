# PWA `apps/web` — Alerta La Paz y El Alto

Adaptador web de la plataforma: una PWA instalable que muestra los incidentes en vivo y permite reportar en dos toques, también sin señal. No contiene reglas de negocio: llama a la API `/v1` con el cliente generado `@gis/api-client` y escucha el tiempo real de la Fase 7.

## Estructura

| Carpeta         | Qué contiene                                                                                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`   | Categorías (cada una, una línea de Mi Teleférico), geometría, `aplicarEvento` (actualiza la lista con un evento público), filtros y la elección del «¿Sigue ahí?» |
| `src/services/` | `almacen` (IndexedDB), `sesion`, `peticion` (token y rechazos), `cola`, `memoria` (propios, votados y preguntados), `votos`, `zonas`, `api` y `tiempo-real`       |
| `src/features/` | `mapa` (Leaflet, capas de calor y zonas), `cerca`, `reporte`, `votos` (detalle y «¿Sigue ahí?»), `filtros`, `calor` y `zonas` (lista y editor)                    |
| `src/ui/`       | Encabezado con la franja de la red, estación, hoja, selector segmentado, avisos e iconos                                                                          |
| `src/sw.ts`     | Service worker (Workbox): precaché, teselas de OSM con límite y Background Sync de la cola                                                                        |

El estado del servidor vive en TanStack Query (`['reportes', ventana]`); el local, en un almacén Zustand (`src/estado.ts`). El diseño está en `DESIGN.md` y la verdad del producto, en `PRODUCT.md`.

## Flujos

- **Sesión (RF-01):** el dispositivo genera un hash aleatorio, sin datos personales, y llama a `POST /v1/dispositivos`. El token se guarda en IndexedDB, para que también lo use el service worker. Se renueva cuando está por vencer o ante un 401.
- **Mapa en vivo (HU-02):**
  - cada movimiento del mapa, con una espera de 300 ms, pide `GET /v1/reportes?bbox=` y envía `viewport:actualizar` por Socket.io;
  - los eventos `evento` se aplican a la caché, y los repetidos se descartan por su `id`;
  - si una reconexión no recuperó lo perdido (`socket.recovered` en falso), se vuelve a pedir la ventana.
- **Reporte en dos toques (HU-01):**
  1. «Reportar» abre la hoja de categorías.
  2. Al tocar una, se toma la posición del GPS, el reporte se guarda en la cola con su `Idempotency-Key` y se envía.
- **Sin señal (HU-05):**
  - lo que no se pudo enviar queda pendiente, visible en el panel;
  - se reenvía al volver el evento `online`, al abrir la app o, donde exista, con Background Sync, aunque la app esté cerrada;
  - un 4xx sale de la cola con su mensaje; un 5xx o la falta de red lo dejan pendiente.
- **Detalle y votos (HU-03):**
  - tocar una estación del mapa o una fila del panel abre su detalle, que se actualiza con los eventos en vivo y se cierra si el reporte deja el mapa;
  - «Sigue ahí» / «Ya no está» votan con la posición del momento; los votos no se encolan sin conexión;
  - el dispositivo recuerda en IndexedDB sus reportes propios y sus votos, para no ofrecer votar lo que la API rechazaría. Nunca se guarda ni se pide `author_id`.
- **«¿Sigue ahí?» automático (HU-03):** solo si el permiso de ubicación ya está concedido (nunca lo pide) y con la app visible. Se sigue la posición con `watchPosition`; ante un reporte a menos de 150 m que no es propio ni se votó, aparece una tarjeta una sola vez por reporte.
- **Filtros:** por línea y por antigüedad (última hora, 3 h, hoy), en el cliente y sobre la lista de la caché. Se recuerdan en `localStorage`; la franja de la red raya las líneas ocultas y el panel dice cuántos incidentes esconden.
- **Historial (HU-06):** el interruptor «Ahora / Historial» cambia las estaciones por el mapa de calor de `GET /v1/mapa-calor` (7, 30 o 90 días, solo las líneas visibles). `leaflet.heat` se descarga al activarlo por primera vez. Si la API responde 404 (módulo apagado), el interruptor se esconde.
- **Zonas (HU-07):** la campana del encabezado lista las zonas propias (`GET /v1/suscripciones`), permite eliminarlas con confirmación y crear una nueva: el mapa muestra una mira fija, el centro es el del mapa y el radio sale de un control deslizante de 100 a 2000 m. Las zonas guardadas se dibujan con trazo discontinuo.

## Comandos

- `pnpm --filter @gis/web dev`: la web en `:5173`, contra `VITE_API_URL` (la API local por defecto).
- `pnpm --filter @gis/web build`: la PWA en `dist/`; Vite informa el tamaño comprimido del JS inicial, que debe quedar bajo 250 KB.
- `pnpm exec vitest run apps/web`: las pruebas (componentes, servicios con IndexedDB en memoria y accesibilidad con axe-core).
