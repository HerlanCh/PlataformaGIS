/** Error base de las reglas de negocio. `code` es estable y lo traducen los adaptadores. */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}
