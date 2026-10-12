# Módulo `identity`

Contrato del módulo. Mantenerlo al día es parte de la Definición de Hecho.

## Responsabilidad

Identificar a los usuarios de forma anónima y asignarles un rol. Un usuario es un dispositivo (por su hash anónimo) y, opcionalmente, una cuenta de Telegram.

No guarda nombres, correos ni otros datos personales. La reputación no vive aquí: es del módulo `verification`.

## Modelo de dominio

| Elemento | Tipo    | Qué hace                                                                                                                                                   |
| :------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`   | Entidad | Identificador, hash del dispositivo, rol (`CIUDADANO` o `MODERADOR`) y Telegram ID opcional. Permite vincular Telegram una sola vez y promover a moderador |

## Eventos que emite

_Ninguno._

## Eventos que escucha

_Ninguno._

## Puertos

| Puerto           | Para qué                                                            |
| :--------------- | :------------------------------------------------------------------ |
| `UserRepository` | Buscar un usuario por ID, por hash de dispositivo o por Telegram ID |

## Interfaz pública

`identityModule` en `index.ts`. Ningún otro módulo la importa: solo la raíz de composición (`apps/*`).

## Tablas propias

`users`. Columnas y restricciones en `docs/diccionario-datos.md`.

## Interruptor

Ninguno: es un módulo imprescindible y siempre está activo.
