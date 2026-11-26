#!/usr/bin/env Rscript
# Contraste de las hipótesis del piloto (ADR-007, perfil v5 6.5 y Tabla 6): pruebas unilaterales
# con alfa = 0,05 y corrección de Holm sobre H1a a H1d, tamaños de efecto, intervalos de Wilson
# para los indicadores de costo y análisis de supervivencia de la caducidad por tipo (Kaplan-Meier).
#
# Uso: Rscript tools/piloto/contraste.R <carpeta-del-analisis> <carpeta-de-salida>
# La carpeta del análisis es la salida de `pnpm piloto:analizar`. Solo usa R base y `survival`,
# que viene con R. Versión fijada: imagen `rocker/r-ver:4.4.2` (ver docs/piloto/README.md).

suppressPackageStartupMessages(library(survival))

argumentos <- commandArgs(trailingOnly = TRUE)
if (length(argumentos) != 2) {
  stop("Uso: Rscript tools/piloto/contraste.R <carpeta-del-analisis> <carpeta-de-salida>")
}
entrada <- argumentos[[1]]
salida <- argumentos[[2]]
dir.create(salida, recursive = TRUE, showWarnings = FALSE)

leer <- function(nombre) {
  read.csv(file.path(entrada, nombre), stringsAsFactors = FALSE, encoding = "UTF-8")
}
a_logico <- function(x) x %in% c("true", "TRUE", TRUE)

ALFA <- 0.05
PRUEBA_PAREADA <- "Wilcoxon de rangos con signo (procesada < base)"

# Delta de Cliff: P(base > procesada) - P(base < procesada) sobre todos los pares de valores. Es
# positivo cuando la vista procesada tiene valores menores (mejor en H1b y H1d).
delta_de_cliff <- function(procesada, base) {
  diferencias <- outer(base, procesada, "-")
  (sum(diferencias > 0) - sum(diferencias < 0)) / length(diferencias)
}

# Wilcoxon de rangos con signo para muestras pareadas, unilateral («menor en la procesada»), con el
# tamaño de efecto que pide la Tabla 6: r = |z| / sqrt(n) o el delta de Cliff.
wilcoxon_pareado <- function(hipotesis, medida, procesada, base, efecto = c("r", "delta de Cliff")) {
  efecto <- match.arg(efecto)
  pares <- complete.cases(procesada, base)
  procesada <- procesada[pares]
  base <- base[pares]
  n <- length(procesada)
  fila <- data.frame(hipotesis, prueba = PRUEBA_PAREADA, medida, n, estadistico = NA, p = NA,
                     efecto = NA, medida_efecto = efecto, ic95_inferior = NA, ic95_superior = NA)
  if (n < 2 || all(procesada == base)) return(fila)
  prueba <- suppressWarnings(wilcox.test(procesada, base, paired = TRUE,
                                         alternative = "less", exact = FALSE))
  fila$estadistico <- unname(prueba$statistic)
  fila$p <- prueba$p.value
  fila$efecto <- if (efecto == "r") abs(qnorm(prueba$p.value)) / sqrt(n) else delta_de_cliff(procesada, base)
  fila
}

# Pares por participante: la tarea en la vista procesada frente a la de la vista base.
pares_de_tareas <- function(tareas, columna) {
  procesada <- tareas[tareas$vista == "PROCESADA", c("participante", columna)]
  base <- tareas[tareas$vista == "BASE", c("participante", columna)]
  merge(procesada, base, by = "participante", suffixes = c("_procesada", "_base"))
}

# H1c: Fisher exacta unilateral (más reales entre lo confirmado), con la razón de odds y la
# diferencia de proporciones con su intervalo de confianza al 95 %.
fisher_de_veracidad <- function(veracidad) {
  confirmado <- a_logico(veracidad$confirmado)
  real <- a_logico(veracidad$real)
  tabla <- table(factor(confirmado, levels = c(TRUE, FALSE)), factor(real, levels = c(TRUE, FALSE)))
  fila <- data.frame(hipotesis = "H1c", prueba = "Exacta de Fisher (confirmado y real)",
                     medida = "reales entre confirmadas frente a no confirmadas", n = sum(tabla),
                     estadistico = NA, p = NA, efecto = NA, medida_efecto = "razón de odds",
                     ic95_inferior = NA, ic95_superior = NA)
  if (sum(tabla[1, ]) == 0 || sum(tabla[2, ]) == 0) return(list(fila = fila, diferencia = NULL))
  fisher <- fisher.test(tabla, alternative = "greater")
  fila$p <- fisher$p.value
  fila$efecto <- unname(fisher$estimate)
  reales <- c(sum(confirmado & real), sum(!confirmado & real))
  totales <- c(sum(confirmado), sum(!confirmado))
  diferencia <- suppressWarnings(prop.test(reales, totales, correct = FALSE))
  list(fila = fila, diferencia = data.frame(
    medida = "diferencia de proporciones (confirmadas - no confirmadas)",
    valor = unname(diferencia$estimate[1] - diferencia$estimate[2]),
    ic95_inferior = diferencia$conf.int[1], ic95_superior = diferencia$conf.int[2]))
}

tareas <- leer("tareas.csv")
incidentes <- leer("incidentes.csv")
veracidad <- leer("veracidad.csv")
vigencia <- leer("vigencia.csv")
supervivencia <- leer("supervivencia.csv")
costos <- leer("costos.csv")

# H1a: segundos para identificar los incidentes activos, por participante.
tiempos <- pares_de_tareas(tareas, "duracion_ms")
h1a <- wilcoxon_pareado("H1a", "segundos para identificar los incidentes activos",
                        tiempos$duracion_ms_procesada / 1000, tiempos$duracion_ms_base / 1000, "r")

# H1b: ítems por incidente único en cada vista.
h1b <- wilcoxon_pareado("H1b", "ítems por incidente único", incidentes$items_procesada,
                        incidentes$items_base, "delta de Cliff")

# H1c: veracidad de las alertas confirmadas.
veraz <- fisher_de_veracidad(veracidad)
h1c <- veraz$fila

# H1d: minutos que un incidente terminado sigue visible, en cada vista.
h1d <- wilcoxon_pareado("H1d", "minutos visible tras el fin", vigencia$exceso_procesada_min,
                        vigencia$exceso_base_min, "delta de Cliff")

contraste <- rbind(h1a, h1b, h1c, h1d)
contraste$p_holm <- p.adjust(contraste$p, method = "holm")
contraste$rechaza_h0 <- !is.na(contraste$p_holm) & contraste$p_holm < ALFA
write.csv(contraste, file.path(salida, "contraste.csv"), row.names = FALSE)
if (!is.null(veraz$diferencia)) {
  write.csv(veraz$diferencia, file.path(salida, "veracidad_diferencia.csv"), row.names = FALSE)
}

# Costos: proporción con su intervalo de Wilson al 95 % (prop.test sin corrección de continuidad).
# La exhaustividad (reales confirmados / reales) es el complemento de «reales sin confirmar».
wilson <- function(casos, total) {
  if (total == 0) return(c(NA, NA))
  suppressWarnings(prop.test(casos, total, correct = FALSE)$conf.int)
}
sin_confirmar <- costos[costos$indicador == "reales sin confirmar", ]
if (nrow(sin_confirmar) == 1) {
  costos <- rbind(costos, data.frame(hipotesis = "H1c", indicador = "exhaustividad",
                                     casos = sin_confirmar$total - sin_confirmar$casos,
                                     total = sin_confirmar$total))
}
intervalos <- t(mapply(wilson, costos$casos, costos$total))
costos$proporcion <- ifelse(costos$total > 0, costos$casos / costos$total, NA)
costos$ic95_inferior <- intervalos[, 1]
costos$ic95_superior <- intervalos[, 2]
write.csv(costos, file.path(salida, "costos_ic.csv"), row.names = FALSE)

# Minutos de anticipo de la caducidad prematura y de la tarea: tasas de acierto y de omisión.
anticipos <- vigencia$anticipo_min[!is.na(vigencia$anticipo_min)]
tasas <- aggregate(cbind(tasa_acierto, tasa_omision) ~ vista, data = tareas, FUN = median)
writeLines(c(sprintf("Minutos de anticipo (mediana, n = %d): %s", length(anticipos),
                     if (length(anticipos) > 0) format(median(anticipos)) else "—"),
             "Tasas de la tarea por vista (medianas):", capture.output(print(tasas, row.names = FALSE))),
           file.path(salida, "descriptivos.txt"))

# Supervivencia de los incidentes reales por categoría: cuánto duran de verdad. S(TTL) es la
# probabilidad de que un incidente siga vivo cuando vence su tiempo de vida (caducidad prematura
# sin confirmaciones que lo extiendan).
sink(file.path(salida, "supervivencia.txt"))
if (nrow(supervivencia) > 0) {
  ajuste <- survfit(Surv(minutos, evento) ~ categoria, data = supervivencia)
  print(ajuste)
  for (categoria in unique(supervivencia$categoria)) {
    ttl <- unique(supervivencia$ttl_minutos[supervivencia$categoria == categoria])[1]
    de_la_categoria <- survfit(Surv(minutos, evento) ~ 1,
                               data = supervivencia[supervivencia$categoria == categoria, ])
    resumen <- summary(de_la_categoria, times = ttl, extend = TRUE)
    cat(sprintf("%s: S(TTL = %s min) = %.3f [IC95 %.3f, %.3f]\n", categoria, ttl,
                resumen$surv, resumen$lower, resumen$upper))
  }
} else {
  cat("Sin incidentes reales verificados.\n")
}
sink()

# La versión de R y de sus paquetes, junto a la salida (ADR-007).
writeLines(capture.output(sessionInfo()), file.path(salida, "sesion.txt"))

print(contraste, row.names = FALSE)
if (!is.null(veraz$diferencia)) print(veraz$diferencia, row.names = FALSE)
print(costos, row.names = FALSE)
