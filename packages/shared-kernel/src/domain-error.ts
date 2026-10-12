/** Error base de las reglas de negocio. `code` es estable y lo traducen los adaptadores. */
export class ErrorDeDominio extends Error {
  readonly codigo: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.codigo = code;
  }
}
