---
name: Alerta LP
description: Mapa comunitario de incidentes de La Paz y El Alto, dibujado como la red de Mi Teleférico.
colors:
  tinta: '#14181d'
  tinta-2: '#4a525c'
  fondo: '#ffffff'
  superficie: '#f4f5f7'
  borde: '#d6dbe1'
  velo: 'rgb(20 24 29 / 45%)'
  linea-amarilla: '#f2b705'
  linea-roja: '#d0102e'
  linea-morada: '#6d2c97'
  linea-cafe: '#7b4a22'
  linea-naranja: '#e46c00'
  linea-verde: '#00843d'
  linea-azul: '#0063bf'
  linea-plateada: '#8a939c'
typography:
  display:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: '-0.01em'
  title:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 800
    lineHeight: 1.4
  body:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.4
  body-strong:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '1.0625rem'
    fontWeight: 700
    lineHeight: 1.4
  secondary:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: 'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '0.04em'
rounded:
  radio: '14px'
  hoja: '20px'
  pastilla: '999px'
spacing:
  e-1: '4px'
  e-2: '8px'
  e-3: '12px'
  e-4: '16px'
  e-5: '24px'
  toque: '48px'
components:
  boton-reportar:
    backgroundColor: '{colors.tinta}'
    textColor: '{colors.fondo}'
    typography: '{typography.title}'
    rounded: '{rounded.radio}'
    height: '60px'
  boton-reportar-hover:
    backgroundColor: '#262c33'
    textColor: '{colors.fondo}'
  boton-texto:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.pastilla}'
    padding: '0 12px'
    height: '48px'
  boton-redondo:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.pastilla}'
    size: '48px'
  estado-conexion:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.pastilla}'
    padding: '0 12px'
    height: '32px'
  fila-de-linea:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.radio}'
    padding: '8px 12px'
    height: '64px'
  aviso:
    backgroundColor: '{colors.tinta}'
    textColor: '{colors.fondo}'
    rounded: '{rounded.radio}'
    padding: '12px 16px'
---

# Design System: Alerta LP

## Overview

**Creative North Star: "Señalética de Mi Teleférico"**

Alerta LP se lee como un panel de estación del teleférico de La Paz: fondo blanco, tinta casi negra, y el color reservado a las líneas. Cada categoría de incidente es una línea de la red con su color, y cada reporte es una estación sobre esa línea. El mapa base va en gris para que lo primero que se lea sean las estaciones de color; la urgencia se comunica con orden y código, no con rojo por todas partes.

La densidad es la de un panel de señalización: pocas piezas, grandes, en una sola familia tipográfica muy legible, pensada para leerse a pleno sol y con una mano. Las formas se reducen a tres: el anillo (estación), la franja (línea) y la pastilla o el rectángulo de esquinas suaves (botones y hojas). La profundidad es mínima y blanda; nada flota sin motivo.

**Key Characteristics:**

- Blanco y tinta como base; el color de las líneas solo como tinta de línea o de estación, nunca como relleno de página.
- La estación en anillo como signo único del reporte, en el mapa, en el diagrama, en la hoja y en el botón de reportar.
- Franja multicolor de 6 px bajo la cabecera como leyenda de la red.
- Mapa de OpenStreetMap en escala de grises.
- Una sola familia (Atkinson Hyperlegible Next) en una escala fija de cinco pasos.

## Colors

Una base acromática de panel de estación y una paleta de líneas de alto croma, cada una con un único significado.

### Primary

- **Tinta de señal** (tinta): texto principal, contornos de estación, bordes de botones de 1,5 px y el fondo del botón «Reportar» y de los avisos. Es el color de mayor peso de la interfaz.

### Secondary (líneas de categoría)

- **Línea Amarilla** (linea-amarilla): bloqueo o protesta vial. También la estación del botón «Reportar» y la selección de texto.
- **Línea Roja** (linea-roja): accidente de tránsito.
- **Línea Morada** (linea-morada): hecho delictivo o robo.
- **Línea Café** (linea-cafe): derrumbe, vía dañada o fuga.
- **Línea Naranja** (linea-naranja): jauría de perros agresivos.

La correspondencia categoría → línea vive en `src/domain/categorias.ts` y es la única fuente; la franja de la red, los marcadores, el diagrama y la hoja la leen de ahí.

### Tertiary (líneas de sistema)

- **Línea Verde** (linea-verde): solo el punto «En vivo» de la conexión y el filo inferior del aviso de éxito.
- **Línea Azul** (linea-azul): anillo de foco, `accent-color` y el punto de «tu ubicación» en el mapa.
- **Línea Plateada** (linea-plateada): estado neutro («Conectando…») y la línea genérica de una categoría desconocida.

### Neutral

- **Panel blanco** (fondo): fondo de cabecera, panel, hoja y botones secundarios.
- **Andén** (superficie): fondo del lienzo del mapa mientras cargan las teselas y del esqueleto de carga.
- **Tinta secundaria** (tinta-2): textos de apoyo (estado, vigencia, ayuda, lugar), con contraste AA sobre blanco.
- **Borde de panel** (borde): divisorias del diagrama, borde de las filas de la hoja y separación panel/mapa.
- **Velo** (velo): fondo tras la hoja de categorías.

### Named Rules

**La regla de la tinta de línea.** Un color de línea solo pinta líneas (tramos, franja) y estaciones; nunca un fondo de página, una tarjeta ni un texto de párrafo.

**La regla de un color, un significado.** Las cinco líneas de categoría no se reutilizan para otra cosa (salvo la amarilla como estación de «Reportar», que es añadir una estación a la red). Verde, azul y plateada son de sistema y no se asignan a categorías.

**La regla del contorno de tinta.** Toda estación lleva un anillo exterior de tinta: así la línea amarilla y cualquier color se distinguen sobre blanco o sobre el mapa (WCAG 1.4.11).

## Typography

**Display Font:** Atkinson Hyperlegible Next Variable (con system-ui, sans-serif)
**Body Font:** la misma familia

**Character:** Una sola humanista diseñada para baja visión, con formas inequívocas (el cero barrado en distancias y horas), usada en pesos 400, 600, 700 y 800. La jerarquía sale del peso y de una escala corta, no de mezclar familias.

### Hierarchy

- **Display** (800, 1.5rem, 1.1): nombre «Alerta LP» y título de la hoja.
- **Title** (800, 1.25rem): título del panel y texto del botón «Reportar».
- **Body** (400/700, 1.0625rem, 1.4): texto base; en 700 para el nombre de la categoría y la distancia.
- **Secondary** (400, 0.9375rem): estado, vigencia, detalle de línea, contador y botón chico.
- **Label** (600, 0.8125rem, 0.04em): el lugar bajo el nombre («La Paz · El Alto»).

Distancias, horas y cuentas usan cifras tabulares para alinearse a la derecha.

### Named Rules

**La regla de la escala fija.** Solo los cinco tamaños de la escala; nada de tamaños fluidos ni intermedios.

## Layout

En el teléfono la pantalla es una columna: cabecera con la franja de la red, el mapa ocupando el centro (mínimo 42dvh) y el panel abajo (máximo 46dvh) con su lista desplazable y el botón «Reportar» fijo al pie. Desde 960 px el cuerpo pasa a dos columnas: panel de 400 px a la izquierda, con borde derecho, y el mapa a la derecha.

El ritmo es de 4 px (4, 8, 12, 16, 24); el margen lateral del contenido es 16 px. Todo objetivo táctil mide al menos 48 px (los botones chicos de texto, 40 px); el botón «Reportar» y las filas del diagrama, 60 px; las filas de la hoja, 64 px. Se respetan las zonas seguras (`env(safe-area-inset-*)`).

El diagrama muestra como máximo cuatro estaciones y cierra con «y N incidentes más en el mapa», para que en un teléfono de 390 × 844 no se corte ninguna fila.

## Elevation & Depth

Sistema plano con sombras blandas solo en lo que flota sobre el mapa o sobre la página. La cabecera, el panel y el diagrama no tienen sombra; se separan con bordes de 1 px.

### Shadow Vocabulary

- **Control flotante** (`box-shadow: 0 2px 8px rgb(20 24 29 / 18%)`): botones redondos sobre el mapa y controles de zoom en escritorio.
- **Transbordo** (`box-shadow: 0 2px 6px rgb(20 24 29 / 25%)`): grupo de reportes en el mapa.
- **Estación sobre mapa** (`filter: drop-shadow(0 1px 2px rgb(20 24 29 / 30%))`): marcadores individuales.
- **Hoja** (`box-shadow: 0 -8px 32px rgb(20 24 29 / 22%)`): hoja de categorías.
- **Aviso** (`box-shadow: 0 6px 20px rgb(20 24 29 / 30%)`): avisos; el tono se marca con un filo inferior interno de 4 px (verde éxito, amarillo problema).

### Named Rules

**La regla del mapa abajo.** Solo lo que está sobre el mapa o sobre el velo lleva sombra; lo que está en la página se separa con bordes.

## Shapes

Tres formas: el círculo (estaciones, transbordos, botones redondos, punto de conexión), la pastilla (botones de texto y estado de conexión, 999 px) y el rectángulo de esquina suave (botón «Reportar», filas de la hoja y avisos, 14 px; la hoja, 20 px solo arriba). Las líneas son franjas rectas sin redondeo: 6 px en la franja de la red y en los tramos del diagrama. Los bordes son de tinta a 1,5 px en controles y de `borde` a 1 px en divisorias.

Los pictogramas son Lucide en SVG, a un solo grosor de trazo (2) en toda la app.

## Components

### Buttons

- **Primario «Reportar»:** ancho completo, tinta con texto blanco, 60 px de alto, esquina de 14 px, Title (800). Lleva a la izquierda una estación amarilla abierta de 26 px, no un signo «+». Hover a #262c33; al presionar, escala 0,98.
- **De texto (pastilla):** blanco con borde de tinta de 1,5 px, 48 px de alto, 700, con pictograma de 18 px. Variante chica de 40 px y texto Secondary («Usar mi ubicación»).
- **Redondo:** 48 × 48 px, blanco, borde de tinta de 1,5 px, sombra de control flotante; escala 0,94 al presionar. Es el botón de ubicarse y el de cerrar la hoja; en escritorio los controles de zoom adoptan esta misma forma. En el teléfono no hay controles de zoom: se acerca con los dedos.
- **Foco:** anillo de 3 px en línea azul con 2 px de separación, en todo elemento.

### Estado de conexión

Pastilla de 32 px con borde de tinta y un punto de 10 px: verde «En vivo», plateado «Conectando…»; «Sin conexión» pasa texto y borde a tinta secundaria. El punto es plano, sin halo ni pulso.

### Estación (componente firma)

SVG de tres círculos concéntricos: anillo exterior de tinta, anillo del color de la línea y centro. Centro blanco = activo (sin confirmar); centro del color de la línea = confirmado. Tamaños: 26 px en el diagrama y en «Reportar», 28 px en el mapa, 30 px en la hoja.

### Transbordo

Un grupo de reportes en el mapa es una estación de transbordo: círculo blanco de 38 px con anillo de tinta de 4 px y el total en 800, cifras tabulares.

### Franja de la red

Debajo de la cabecera, cinco tramos iguales de 6 px con los colores de las categorías en orden; es la leyenda, y para lectores de pantalla nombra cada línea y su categoría.

### Diagrama de línea

Cada fila es una rejilla de 30 px (tramo) + texto + datos a la derecha. El tramo es una franja vertical de 6 px del color de la línea que corre de borde a borde de la fila, con la estación centrada; los tramos de filas contiguas se tocan y forman la línea. La divisoria de 1 px empieza después del tramo, sin cortarlo, y la última fila no la lleva. Izquierda: categoría (700) y estado (Secondary). Derecha: distancia (700) y «hasta HH:MM» (Secondary). Carga con tres filas esqueleto con brillo lineal.

### Hoja de categorías

Diálogo modal desde abajo, máximo 520 px, esquinas superiores de 20 px, velo detrás; entra subiendo 24 px en 260 ms. Cada categoría es una fila-botón de 64 px: estación confirmada de 30 px, nombre (700) y «Línea X · se muestra N h» (Secondary), y el pictograma a la derecha. Borde de 1,5 px en `borde` que pasa a tinta al pasar el puntero; escala 0,98 al presionar. Un toque envía el reporte.

### Avisos

Rectángulo de tinta con texto blanco 700, arriba y centrado, máximo 440 px; el tono es un filo inferior de 4 px, nunca un fondo de color.

### Mapa

Teselas de OpenStreetMap con `grayscale(1) contrast(0.9) brightness(1.06)`; atribución visible a 11 px. «Tu ubicación» es un círculo azul de radio 8 con borde blanco de 3 px.

### Movimiento

Salida exponencial `cubic-bezier(0.16, 1, 0.3, 1)`, 180 ms para respuestas al toque y 260 ms para entradas. Con `prefers-reduced-motion` se anulan animaciones y transiciones.

## Do's and Don'ts

### Do:

- **Do** dibujar todo reporte como estación en anillo con contorno de tinta, con el color de su línea tomado de `categorias.ts`.
- **Do** usar el centro relleno solo para «confirmado» y el centro blanco para «activo».
- **Do** mantener el mapa base en escala de grises para que las líneas sean lo primero que se lee.
- **Do** separar lo que está en la página con bordes de 1 px y reservar la sombra a lo que flota.
- **Do** dar 48 px como mínimo a todo control táctil y usar cifras tabulares en distancias y horas.
- **Do** marcar el tono de un aviso con un filo de 4 px del color de sistema, sobre fondo de tinta.

### Don't:

- **Don't** usar un color de línea como fondo de página, de tarjeta o de botón.
- **Don't** asignar verde, azul ni plateada a una categoría: son colores de sistema.
- **Don't** usar alfileres rojos ni un botón flotante azul con «+» para reportar: reportar es añadir una estación.
- **Don't** añadir halos, resplandores ni pulsos al punto de conexión o a las estaciones.
- **Don't** introducir una segunda familia tipográfica ni tamaños fuera de la escala de cinco pasos.
- **Don't** cortar el tramo de color del diagrama con divisorias.
