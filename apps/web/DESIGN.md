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
  boton-primario:
    backgroundColor: '{colors.tinta}'
    textColor: '{colors.fondo}'
    typography: '{typography.title}'
    rounded: '{rounded.radio}'
    height: '60px'
  boton-primario-hover:
    backgroundColor: '#262c33'
    textColor: '{colors.fondo}'
  boton-texto:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.pastilla}'
    padding: '0 12px'
    height: '48px'
  boton-texto-pie:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    typography: '{typography.body-strong}'
    rounded: '{rounded.radio}'
    padding: '0 16px'
    height: '60px'
  boton-texto-tinta:
    backgroundColor: '{colors.tinta}'
    textColor: '{colors.fondo}'
    rounded: '{rounded.pastilla}'
    padding: '0 12px'
    height: '40px'
  boton-redondo:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.pastilla}'
    size: '48px'
  boton-redondo-chico:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.pastilla}'
    size: '40px'
  boton-voto:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.radio}'
    height: '60px'
  boton-voto-hover:
    backgroundColor: '{colors.superficie}'
    textColor: '{colors.tinta}'
  segmentado:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    typography: '{typography.secondary}'
    rounded: '{rounded.pastilla}'
    padding: '3px'
    height: '40px'
  segmentado-elegido:
    backgroundColor: '{colors.tinta}'
    textColor: '{colors.fondo}'
    rounded: '{rounded.pastilla}'
    padding: '0 12px'
  chip:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta-2}'
    typography: '{typography.secondary}'
    rounded: '{rounded.pastilla}'
    height: '44px'
  chip-activo:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
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
  fila-de-ficha:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    typography: '{typography.body}'
    height: '48px'
  sigue-ahi:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.radio}'
    padding: '12px 16px 8px'
    width: '440px'
  barra-calor:
    backgroundColor: '{colors.fondo}'
    textColor: '{colors.tinta}'
    rounded: '{rounded.radio}'
    padding: '8px'
    width: '440px'
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

La densidad es la de un panel de señalización: pocas piezas, grandes, en una sola familia tipográfica muy legible, pensada para leerse a pleno sol y con una mano. Las formas se reducen a tres: el anillo (estación), la franja (línea) y la pastilla o el rectángulo de esquinas suaves (botones y hojas). La profundidad es mínima y blanda; nada flota sin motivo. Los controles se comportan como un tablero de la red: las líneas se encienden y se apagan, los modos se eligen en un riel de tinta, y todo lo que no es un reporte (zonas, mira, historial) se dibuja solo en tinta.

**Key Characteristics:**

- Blanco y tinta como base; el color de las líneas solo como tinta de línea o de estación, nunca como relleno de página.
- La estación en anillo como signo único del reporte, en el mapa, en el diagrama, en las hojas, en los avisos y en el botón de reportar.
- Franja multicolor de 6 px bajo la cabecera como leyenda de la red; una línea apagada por los filtros se ve rayada.
- Mapa de OpenStreetMap en escala de grises; zonas, mira e historial en tinta sobre él.
- Una sola familia (Atkinson Hyperlegible Next) en una escala fija de cinco pasos.

## Colors

Una base acromática de panel de estación y una paleta de líneas de alto croma, cada una con un único significado.

### Primary

- **Tinta de señal** (tinta): texto principal, contornos de estación, bordes de botones de 1,5 px, el fondo de los botones primarios («Reportar», «Listo», «Nueva zona», «Guardar zona»), del segmento elegido y de los avisos. Es también el trazo de las zonas y de la mira, el extremo más oscuro del mapa de calor y el `accent-color` del control de radio de la zona. Es el color de mayor peso de la interfaz.

### Secondary (líneas de categoría)

- **Línea Amarilla** (linea-amarilla): bloqueo o protesta vial. También la estación del botón «Reportar» y la selección de texto.
- **Línea Roja** (linea-roja): accidente de tránsito.
- **Línea Morada** (linea-morada): hecho delictivo o robo.
- **Línea Café** (linea-cafe): derrumbe, vía dañada o fuga.
- **Línea Naranja** (linea-naranja): jauría de perros agresivos.

La correspondencia categoría → línea vive en `src/domain/categorias.ts` y es la única fuente; la franja de la red, los marcadores, el diagrama, las hojas, los filtros y las zonas la leen de ahí.

### Tertiary (líneas de sistema)

- **Línea Verde** (linea-verde): solo el punto «En vivo» de la conexión y el filo inferior del aviso de éxito.
- **Línea Azul** (linea-azul): anillo de foco, `accent-color` global, el punto de «tu ubicación» en el mapa y el punto de 12 px (con borde blanco de 2 px) que marca en el botón de filtros que hay filtros activos.
- **Línea Plateada** (linea-plateada): estado neutro («Conectando…»), la línea genérica de una categoría desconocida y el paso medio de la escala de tinta del mapa de calor.

### Neutral

- **Panel blanco** (fondo): fondo de cabecera, panel, hojas, tarjeta «¿Sigue ahí?», barra del historial y botones secundarios.
- **Andén** (superficie): fondo del lienzo del mapa mientras cargan las teselas, del esqueleto de carga, de la nota del detalle y del paso del puntero sobre filas del diagrama y botones de voto.
- **Tinta secundaria** (tinta-2): textos de apoyo (estado, vigencia, ayuda, lugar, etiquetas de la ficha) y el borde y texto de un chip apagado, con contraste AA sobre blanco.
- **Borde de panel** (borde): divisorias del diagrama, de la ficha y de la lista de zonas, borde de las filas de la hoja, separación panel/mapa y el paso más claro del mapa de calor.
- **Velo** (velo): fondo tras las hojas.

### Named Rules

**La regla de la tinta de línea.** Un color de línea solo pinta líneas (tramos, franja) y estaciones; nunca un fondo de página, una tarjeta ni un texto de párrafo.

**La regla de un color, un significado.** Las cinco líneas de categoría no se reutilizan para otra cosa (salvo la amarilla como estación de «Reportar», que es añadir una estación a la red). Verde, azul y plateada son de sistema y no se asignan a categorías.

**La regla del contorno de tinta.** Toda estación lleva un anillo exterior de tinta: así la línea amarilla y cualquier color se distinguen sobre blanco o sobre el mapa (WCAG 1.4.11).

**La regla del historial en tinta.** El mapa de calor usa solo la escala de tinta (borde → plateada → tinta secundaria → tinta, de 0,25 a 1, con la capa al 85 %); nunca un color de línea, que ya significa una categoría. Más oscuro es más reportes.

## Typography

**Display Font:** Atkinson Hyperlegible Next Variable (con system-ui, sans-serif)
**Body Font:** la misma familia

**Character:** Una sola humanista diseñada para baja visión, con formas inequívocas (el cero barrado en distancias y horas), usada en pesos 400, 600, 700 y 800. La jerarquía sale del peso y de una escala corta, no de mezclar familias.

### Hierarchy

- **Display** (800, 1.5rem, 1.1): nombre «Alerta LP» y título de las hojas (este, equilibrado en varias líneas).
- **Title** (800, 1.25rem): título del panel y del editor, texto de los botones primarios, «¿Sigue ahí?» en el detalle y en la tarjeta automática.
- **Body** (400/700, 1.0625rem, 1.4): texto base; en 700 para el nombre de la categoría, la distancia, los valores de la ficha y las etiquetas de sección de las hojas y del editor («Reportados en», «Líneas», «Radio», «Avisarme de»).
- **Secondary** (400/700, 0.9375rem): estado, vigencia, detalle de línea, ayudas, contador y botón chico; en 700 para los segmentos del riel y los chips.
- **Label** (600, 0.8125rem, 0.04em): solo el lugar bajo el nombre («La Paz · El Alto»).

Distancias, horas, cuentas y el radio de la zona usan cifras tabulares para alinearse a la derecha.

### Named Rules

**La regla de la escala fija.** Solo los cinco tamaños de la escala; nada de tamaños fluidos ni intermedios.

**La regla de la etiqueta única.** El estilo espaciado de Label es del lugar en la cabecera y de nada más; las etiquetas de sección son Body en 700, en tinta.

## Layout

En el teléfono la pantalla es una columna: cabecera con la franja de la red, el mapa ocupando el centro (mínimo 42dvh) y el panel abajo (máximo 46dvh) con su lista desplazable y el botón «Reportar» fijo al pie. Desde 960 px el cuerpo pasa a dos columnas: panel de 400 px a la izquierda, con borde derecho, y el mapa a la derecha. Al dibujar una zona, el panel se reemplaza por el editor (máximo 52dvh), con su cuerpo desplazable y las acciones al pie.

Sobre el mapa, las herramientas van arriba a la izquierda (riel «Ahora / Historial» y botón de filtros); abajo a la izquierda, a la izquierda del botón de ubicarse, va o la tarjeta «¿Sigue ahí?» o la barra del historial, ambas de máximo 440 px. Cuando aparece la tarjeta, el mapa se desplaza para que la estación por la que se pregunta quede visible por encima de ella. La tarjeta no aparece en el historial ni mientras se dibuja una zona; las herramientas se ocultan mientras se dibuja.

El ritmo es de 4 px (4, 8, 12, 16, 24); el margen lateral del contenido es 16 px. Todo objetivo táctil mide al menos 48 px (los botones chicos de texto, los redondos chicos y los segmentos, 40 px; los chips, 44 px); el botón «Reportar», los botones primarios, los de voto, los de texto al pie de una hoja y las filas del diagrama, 60 px; las filas de la hoja y de la lista de zonas, 64 px; las filas de la ficha, 48 px. Se respetan las zonas seguras (`env(safe-area-inset-*)`).

El diagrama muestra como máximo cuatro estaciones y cierra con «y N incidentes más en el mapa», para que en un teléfono de 390 × 844 no se corte ninguna fila.

## Elevation & Depth

Sistema plano con sombras blandas solo en lo que flota sobre el mapa o sobre la página. La cabecera, el panel, el diagrama y la ficha no tienen sombra; se separan con bordes de 1 px.

### Shadow Vocabulary

- **Control flotante** (`box-shadow: 0 2px 8px rgb(20 24 29 / 18%)`): botones redondos sobre el mapa, controles de zoom en escritorio, el riel «Ahora / Historial» y la barra del historial.
- **Transbordo** (`box-shadow: 0 2px 6px rgb(20 24 29 / 25%)`): grupo de reportes en el mapa.
- **Estación sobre mapa** (`filter: drop-shadow(0 1px 2px rgb(20 24 29 / 30%))`): marcadores individuales.
- **Hoja** (`box-shadow: 0 -8px 32px rgb(20 24 29 / 22%)`): hojas modales.
- **Aviso** (`box-shadow: 0 6px 20px rgb(20 24 29 / 30%)`): avisos y la tarjeta «¿Sigue ahí?»; en los avisos el tono se marca con un filo inferior interno de 4 px (verde éxito, amarillo problema).

### Named Rules

**La regla del mapa abajo.** Solo lo que está sobre el mapa o sobre el velo lleva sombra; lo que está en la página se separa con bordes. Un botón redondo dentro de una lista de la página va plano, sin sombra.

## Shapes

Tres formas: el círculo (estaciones, transbordos, botones redondos, puntos de conexión y de filtros, zonas), la pastilla (botones de texto, estado de conexión, riel segmentado, segmento elegido y chips, 999 px) y el rectángulo de esquina suave (botones primarios, de voto y de texto al pie, filas de la hoja, nota del detalle, tarjeta «¿Sigue ahí?», barra del historial y avisos, 14 px; la hoja, 20 px solo arriba). Las líneas son franjas rectas sin redondeo: 6 px en la franja de la red y en los tramos del diagrama. Los bordes son de tinta a 1,5 px en controles y de `borde` a 1 px en divisorias.

Sobre el mapa, lo que no es un reporte se traza en tinta: la zona suscrita es un círculo de trazo discontinuo de 2 (6 6) con relleno de tinta al 4 %; la zona que se dibuja, trazo pleno de 3 con relleno al 8 %; la mira, una cruz de dos barras de 2,5 px en 30 px con un hueco central de 8 px y un halo blanco de 1 px.

Los pictogramas son Lucide en SVG, a un solo grosor de trazo (2) en toda la app.

### Named Rules

**La regla del anillo reservado.** El anillo es el signo del reporte y de nada más. La mira para dibujar una zona es una cruz con el centro libre, nunca un anillo; las zonas son círculos de tinta sin color de línea.

## Components

### Buttons

- **Primario «Reportar»:** ancho completo, tinta con texto blanco, 60 px de alto, esquina de 14 px, Title (800). Lleva a la izquierda una estación amarilla abierta de 26 px, no un signo «+». Hover a #262c33; al presionar, escala 0,98.
- **Primario de hoja y editor:** el mismo rectángulo de tinta de 60 px y 14 px para «Listo», «Nueva zona» (con pictograma «+», porque crea una zona, no un reporte) y «Guardar zona»; ocupa el espacio libre del pie. Deshabilitado, al 45 % de opacidad y sin hover ni escala.
- **De texto (pastilla):** blanco con borde de tinta de 1,5 px, 48 px de alto, 700, con pictograma de 18 px. Variante chica de 40 px y texto Secondary («Usar mi ubicación», «Cancelar»). Variante de tinta (relleno de tinta, texto blanco) solo para confirmar una acción destructiva («Sí, eliminar»).
- **De texto al pie:** en el pie de una hoja o del editor, el secundario («Quitar filtros», «Cancelar») toma la altura del primario: 60 px y esquina de 14 px, con 16 px de margen lateral.
- **Redondo:** 48 × 48 px, blanco, borde de tinta de 1,5 px, sombra de control flotante; escala 0,94 al presionar. Es el botón de ubicarse, el de filtros y el de cerrar la hoja; en escritorio los controles de zoom adoptan esta misma forma. En el teléfono no hay controles de zoom: se acerca con los dedos. Variante chica de 40 px en la cabecera («Mis zonas») y en la lista de zonas (eliminar, plana).
- **De voto:** dos botones iguales en rejilla de dos columnas, «Sigue ahí» y «Ya no está», blancos con borde de tinta de 1,5 px, 60 px, esquina de 14 px, 800 con pictograma de 22 px; del mismo tamaño para no sugerir ninguna respuesta. Hover a superficie; escala 0,98 al presionar.
- **Foco:** anillo de 3 px en línea azul con 2 px de separación, en todo elemento.

### Selector segmentado

Radios nativos dibujados como un riel: pastilla blanca con borde de tinta de 1,5 px y 3 px de relleno; segmentos iguales de 40 px, Secondary 700. El elegido es una pastilla de tinta con texto blanco. Su leyenda es Body 700; sobre el mapa se oculta a la vista y queda para el lector de pantalla. Se usa para «Ahora / Historial», el periodo del historial (7, 30, 90 días) y la antigüedad de los filtros (1 hora, 3 horas, Hoy, Todos).

### Chips

Pastillas de 44 px con estación confirmada de la línea y su nombre corto en Secondary 700, para elegir de qué líneas avisa una zona. Encendido: borde y texto de tinta. Apagado: borde y texto en tinta secundaria, estación al 30 % y pictograma de campana tachada. La estación siempre va en su forma confirmada.

### Estado de conexión

Pastilla de 32 px con borde de tinta y un punto de 10 px: verde «En vivo», plateado «Conectando…»; «Sin conexión» pasa texto y borde a tinta secundaria. El punto es plano, sin halo ni pulso.

### Estación (componente firma)

SVG de tres círculos concéntricos: anillo exterior de tinta, anillo del color de la línea y centro. Centro blanco = activo (sin confirmar); centro del color de la línea = confirmado. Tamaños: 18 px en la lista de zonas, 22 px en la ficha, 26 px en el diagrama, en la tarjeta «¿Sigue ahí?» y en «Reportar», 28 px en el mapa, 30 px en la hoja y en los filtros.

### Transbordo

Un grupo de reportes en el mapa es una estación de transbordo: círculo blanco de 38 px con anillo de tinta de 4 px y el total en 800, cifras tabulares.

### Franja de la red

Debajo de la cabecera, cinco tramos iguales de 6 px con los colores de las categorías en orden; es la leyenda, y para lectores de pantalla nombra cada línea y su categoría. Una línea oculta por los filtros se dibuja rayada (franjas de 4 px de su color y 3 px de blanco a −45°) al 45 %, y el lector la anuncia como oculta.

### Diagrama de línea

Cada fila es un botón que abre el detalle de su estación: una rejilla de 30 px (tramo) + texto + datos a la derecha. El tramo es una franja vertical de 6 px del color de la línea que corre de borde a borde de la fila, con la estación centrada; los tramos de filas contiguas se tocan y forman la línea. La divisoria de 1 px empieza después del tramo, sin cortarlo, y la última fila no la lleva; al pasar el puntero, la fila se tiñe de superficie también solo después del tramo. Izquierda: categoría (700) y estado (Secondary). Derecha: distancia (700) y «hasta HH:MM» (Secondary). Carga con tres filas esqueleto con brillo lineal. Cuando hay filtros, un aviso en Secondary bajo el título del panel dice cuántos incidentes quedan ocultos y ofrece quitarlos.

### Hojas

Diálogo modal desde abajo, máximo 520 px, esquinas superiores de 20 px, velo detrás; entra subiendo 24 px en 260 ms. La cabecera alinea el título (Display, equilibrado) y el botón redondo de cerrar con 12 px de separación, sin que el botón se encoja. Se cierra con su botón, con Escape o tocando el velo. Las secciones se titulan en Body 700 con 24 px arriba; el pie lleva el primario a la derecha ocupando el espacio libre y, si hace falta, el secundario de 60 px a su izquierda.

### Hoja de categorías

Cada categoría es una fila-botón de 64 px: estación confirmada de 30 px, nombre (700) y «Línea X · se muestra N h» (Secondary), y el pictograma a la derecha. Borde de 1,5 px en `borde` que pasa a tinta al pasar el puntero; escala 0,98 al presionar. Un toque envía el reporte.

### Hoja de filtros

El riel de antigüedad y, bajo «Líneas», las mismas filas de 64 px como interruptores: encendida, «se ve en el mapa» y un ojo; apagada, estación al 30 %, nombre y pictograma en tinta secundaria, «oculta» y ojo tachado. El pie lleva «Quitar filtros» (solo con filtros) y «Listo».

### Detalle del reporte

Hoja con la categoría como título y «Línea X» como ayuda. La ficha es una lista de filas de 48 px separadas por 1 px de `borde`: la etiqueta en tinta secundaria a la izquierda y el valor en 700, cifras tabulares, a la derecha (estado con su estación de 22 px, distancia «de ti» o «del centro del mapa» si no hay GPS, hora del reporte y vigencia). Debajo, «¿Sigue ahí?» en Title con una ayuda Secondary y los dos botones de voto; si no se puede votar, una nota en superficie con esquina de 14 px.

### Tarjeta «¿Sigue ahí?»

Aparece sola al pasar cerca de un incidente: rectángulo blanco con borde de tinta de 1,5 px, esquina de 14 px y sombra de aviso, que entra en 260 ms. Cabecera con la estación de 26 px y la pregunta en Title equilibrada («¿Sigue ahí el bloqueo a 80 m?»), los dos botones de voto y un «No sé» subrayado en tinta secundaria 700. No bloquea el mapa.

### Historial (mapa de calor)

Barra blanca con borde de tinta de 1,5 px, esquina de 14 px y sombra de control flotante, con el riel de periodo a todo el ancho y una frase de estado en Secondary («Más oscuro, más reportes. Solo zonas con 3 o más.»). El calor se pinta con la escala de tinta de la regla del historial.

### Zonas

La hoja «Mis zonas» lista cada zona en filas de 64 px con divisoria de 1 px: nombre en 700 y sus líneas como estaciones de 18 px con nombre corto en Secondary; eliminar es un redondo chico plano que, al tocarlo, se cambia por «Cancelar» y «Sí, eliminar». Al pie, «Nueva zona» y una nota centrada en Secondary. El editor muestra la mira en el centro del mapa, el radio con su valor en 800 tabular y un control deslizante de 48 px con `accent-color` de tinta, los chips de líneas y, al pie, «Cancelar» y «Guardar zona».

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
- **Do** mostrar una línea apagada atenuando su estación al 30 % y rayando su tramo en la franja, sin quitarla de la vista.
- **Do** trazar en tinta todo lo que no es un reporte sobre el mapa: zonas, mira y calor.

### Don't:

- **Don't** usar un color de línea como fondo de página, de tarjeta o de botón.
- **Don't** asignar verde, azul ni plateada a una categoría: son colores de sistema.
- **Don't** usar alfileres rojos ni un botón flotante azul con «+» para reportar: reportar es añadir una estación.
- **Don't** añadir halos, resplandores ni pulsos al punto de conexión o a las estaciones.
- **Don't** introducir una segunda familia tipográfica ni tamaños fuera de la escala de cinco pasos.
- **Don't** cortar el tramo de color del diagrama con divisorias.
- **Don't** dibujar un anillo para algo que no sea un reporte: la mira es una cruz.
- **Don't** pintar el mapa de calor con colores de línea ni con una rampa de color.
