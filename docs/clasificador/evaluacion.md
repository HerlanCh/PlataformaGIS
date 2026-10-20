# Evaluación del clasificador

Generado con `pnpm clasificador:evaluar` el 2026-10-20. No editar a mano.

- **Clasificador:** `reglas-v1`
- **Conjunto:** `tools/clasificador/conjunto-sintetico.jsonl`, 200 ejemplos; se mide sobre su partición de prueba (67 ejemplos, elegidos por un hash estable del texto).

## Métricas

| Métrica | Valor |
| :-- | --: |
| Precisión (de lo marcado, cuánto era sospechoso) | 100,0 % |
| Exhaustividad (de lo sospechoso, cuánto se marcó) | 73,7 % |
| F1 | 84,8 % |

| | Marcado | No marcado |
| :-- | --: | --: |
| **Sospechoso** | 14 | 5 |
| **Normal** | 0 | 48 |

## Fallos

| Tipo | Texto | Motivos |
| :-- | :-- | :-- |
| Falso negativo | Préstamos a sola firma, interés bajo | — |
| Falso negativo | xd | LONGITUD_ANORMAL |
| Falso negativo | Venta de entradas para el concierto, consulta al privado | — |
| Falso negativo | asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf | LONGITUD_ANORMAL |
| Falso negativo | Reporten al chofer de la línea 2, su nombre es Luis Quispe | — |
