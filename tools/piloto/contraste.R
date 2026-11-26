#!/usr/bin/env Rscript
# Contraste de las hipótesis del piloto (ADR-007): pruebas unilaterales con alfa = 0,05 y
# corrección de Holm, tamaños de efecto, intervalos de Wilson para los indicadores de costo y
# análisis de supervivencia de la caducidad por tipo (Kaplan-Meier).
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

# Wilcoxon de rangos con signo para muestras pareadas, unilateral («menor en la procesada»).
# Tamaño de efecto r = |z| / sqrt(n), con z del valor p unilateral.
wilcoxon_pareado <- function(hipotesis, medida, procesada, base) {
  pares <- complete.cases(procesada, base)
  procesada <- procesada[pares]
  base <- base[pares]
  n <- length(procesada)
  if (n < 2 || all(procesada == base)) {
    return(data.frame(hipotesis, prueba = "Wilcoxon pareado (procesada < base)", medida, n,
                      estadistico = NA, p = NA, efecto = NA, medida_efecto = "r"))
  }
  prueba <- suppressWarnings(wilcox.test(procesada, base, paired = TRUE,
                                         alternative = "less", exact = FALSE))
  z <- qnorm(prueba$p.value)
  data.frame(hipotesis, prueba = "Wilcoxon pareado (procesada < base)", medida, n,
             estadistico = unname(prueba$statistic), p = prueba$p.value,
             efecto = abs(z) / sqrt(n), medida_efecto = "r")
}

# Pares por participante: la tarea en la vista procesada frente a la de la vista base.
pares_de_tareas <- function(tareas, columna) {
  procesada <- tareas[tareas$vista == "PROCESADA", c("participante", columna)]
  base <- tareas[tareas$vista == "BASE", c("participante", columna)]
  merge(procesada, base, by = "participante", suffixes = c("_procesada", "_base"))
}

tareas <- leer("tareas.csv")
veracidad <- leer("veracidad.csv")
vigencia <- leer("vigencia.csv")
supervivencia <- leer("supervivencia.csv")
costos <- leer("costos.csv")

# H1a: oportunidad de localización (tiempo de la tarea).
tiempos <- pares_de_tareas(tareas, "duracion_ms")
h1a <- wilcoxon_pareado("H1a", "tiempo de la tarea (ms)",
                        tiempos$duracion_ms_procesada, tiempos$duracion_ms_base)

# H1b: redundancia (marcados de más por participante).
de_mas <- pares_de_tareas(tareas, "de_mas")
h1b <- wilcoxon_pareado("H1b", "marcados de más", de_mas$de_mas_procesada, de_mas$de_mas_base)

# H1c: veracidad (proporción de reales entre lo confirmado frente a lo no confirmado), Fisher
# unilateral con la razón de odds como tamaño de efecto.
tabla <- table(factor(a_logico(veracidad$confirmado), levels = c(TRUE, FALSE)),
               factor(a_logico(veracidad$real), levels = c(TRUE, FALSE)))
if (sum(tabla) >= 2) {
  fisher <- fisher.test(tabla, alternative = "greater")
  h1c <- data.frame(hipotesis = "H1c", prueba = "Fisher exacta (confirmado y real)",
                    medida = "reales entre lo confirmado", n = sum(tabla), estadistico = NA,
                    p = fisher$p.value, efecto = unname(fisher$estimate),
                    medida_efecto = "razón de odds")
} else {
  h1c <- data.frame(hipotesis = "H1c", prueba = "Fisher exacta (confirmado y real)",
                    medida = "reales entre lo confirmado", n = sum(tabla), estadistico = NA,
                    p = NA, efecto = NA, medida_efecto = "razón de odds")
}

# H1d: vigencia (minutos visibles después del fin, por reporte, en cada vista).
h1d <- wilcoxon_pareado("H1d", "minutos visibles después del fin",
                        vigencia$exceso_procesada_min, vigencia$exceso_base_min)

contraste <- rbind(h1a, h1b, h1c, h1d)
contraste$p_holm <- p.adjust(contraste$p, method = "holm")
contraste$rechaza_h0 <- !is.na(contraste$p_holm) & contraste$p_holm < ALFA
write.csv(contraste, file.path(salida, "contraste.csv"), row.names = FALSE)

# Costos: proporción con su intervalo de Wilson al 95 % (prop.test sin corrección de continuidad).
wilson <- function(casos, total) {
  if (total == 0) return(c(NA, NA))
  suppressWarnings(prop.test(casos, total, correct = FALSE)$conf.int)
}
intervalos <- t(mapply(wilson, costos$casos, costos$total))
costos$proporcion <- ifelse(costos$total > 0, costos$casos / costos$total, NA)
costos$ic95_inferior <- intervalos[, 1]
costos$ic95_superior <- intervalos[, 2]
write.csv(costos, file.path(salida, "costos_ic.csv"), row.names = FALSE)

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
print(costos, row.names = FALSE)
