# PWA `apps/web` — Alerta La Paz y El Alto

Adaptador web de la plataforma: una PWA instalable que muestra los incidentes en vivo y permite reportar en dos toques, también sin señal. No contiene reglas de negocio: llama a la API `/v1` con el cliente generado `@gis/api-client` y escucha el tiempo real de la Fase 7.

## Estructura

| Carpeta         | Qué contiene                                                                                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`   | Categorías (cada una, una línea de Mi Teleférico), geometría (distancias, ventana) y `aplicarEvento`, que actualiza la lista de una ventana con un evento público |
| `src/services/` | `almacen` (IndexedDB), `sesion` (registro anónimo y token), `cola` (reportes pendientes de envío) y `tiempo-real` (Socket.io)                                     |
| `src/features/` | `mapa` (Leaflet y la consulta por ventana), `cerca` (panel «Cerca de ti») y `reporte` (hoja de categorías, envío y mensajes)                                      |
| `src/ui/`       | Encabezado con la franja de la red, estación, avisos e iconos                                                                                                     |
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

## Comandos

- `pnpm --filter @gis/web dev`: la web en `:5173`, contra `VITE_API_URL` (la API local por defecto).
- `pnpm --filter @gis/web build`: la PWA en `dist/`; Vite informa el tamaño comprimido del JS inicial, que debe quedar bajo 250 KB.
- `pnpm exec vitest run apps/web`: las pruebas (componentes, servicios con IndexedDB en memoria y accesibilidad con axe-core).
