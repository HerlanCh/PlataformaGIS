export interface Exito<T> {
  readonly exitoso: true;
  readonly valor: T;
}

export interface Fallo<E> {
  readonly exitoso: false;
  readonly error: E;
}

/** Resultado explícito de una operación que puede fallar por una regla de negocio. */
export type Resultado<T, E> = Exito<T> | Fallo<E>;

export const exito = <T>(value: T): Exito<T> => ({ exitoso: true, valor: value });

export const fallo = <E>(error: E): Fallo<E> => ({ exitoso: false, error });
