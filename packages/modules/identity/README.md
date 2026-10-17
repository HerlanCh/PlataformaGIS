# Módulo `identity`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Identificar a los usuarios de forma anónima y asignarles un rol. Un usuario es un dispositivo (por su hash anónimo) y, opcionalmente, una cuenta de Telegram.

No guarda nombres, correos ni otros datos personales. La reputación no vive aquí: es del módulo `verification`.

## Modelo de dominio

| Elemento  | Tipo    | Qué hace                                                                                                                                                   |
| :-------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Usuario` | Entidad | Identificador, hash del dispositivo, rol (`CIUDADANO` o `MODERADOR`) y Telegram ID opcional. Permite vincular Telegram una sola vez y promover a moderador |

## Casos de uso (Fase 5)

`RegistrarDispositivo` (RF-01): crea un usuario anónimo para el dispositivo o devuelve el que ya tiene. La credencial (JWT) la emite la API en la Fase 6.

## Eventos que emite

_Ninguno._

## Eventos que escucha

_Ninguno._

## Puertos

| Puerto                  | Para qué                                                            |
| :---------------------- | :------------------------------------------------------------------ |
| `RepositorioDeUsuarios` | Buscar un usuario por ID, por hash de dispositivo o por Telegram ID |

## Interfaz pública

`identityModulo` en `index.ts`, junto con `RegistrarDispositivo` y el adaptador `RepositorioUsuariosPg`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`usuarios`. Columnas y restricciones en `docs/diccionario-datos.md`.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
